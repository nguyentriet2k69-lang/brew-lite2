import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { Order, OrderStatus } from '../orders/order.entity';
import { InventoryReservation, ReservationStatus } from '../inventory/inventory-reservation.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentMethod,
} from './payment-attempt.entity';
import {
  GatewayChargeRequest,
  GatewayPaymentResult,
  PaymentGateway,
} from './payment-gateway';

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

type GatewayAction = 'charge' | 'lookup' | 'replay';

interface StartedAttempt {
  attempt: PaymentAttempt;
  orderStatus: OrderStatus;
  action: GatewayAction;
}

export interface PaymentResponse {
  paymentAttemptId: string;
  orderId: string;
  reservationId: string;
  status: PaymentAttemptStatus;
  method: PaymentMethod;
  amount: number;
  currency: 'VND';
  gatewayReference: string | null;
  failureCode: string | null;
  createdAt: Date;
  completedAt: Date | null;
  orderStatus: OrderStatus;
}

export interface PaymentDetailResponse extends PaymentResponse {
  reservationStatus: ReservationStatus;
  updatedAt: Date;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  /** Read the persisted attempt state for polling; this method never contacts the gateway. */
  async findOwned(userId: string, paymentAttemptId: string): Promise<PaymentDetailResponse> {
    const attempt = await this.dataSource.getRepository(PaymentAttempt).findOne({
      where: { id: paymentAttemptId },
      relations: { order: true, reservation: true },
    });
    if (!attempt || attempt.order.userId !== userId) {
      throw new NotFoundException({ code: 'PAYMENT_ATTEMPT_NOT_FOUND', message: 'Payment attempt was not found.' });
    }
    return {
      ...this.toResponse(attempt, attempt.order.status),
      reservationStatus: attempt.reservation.status,
      updatedAt: attempt.updatedAt,
    };
  }

  async createOrReplay(
    userId: string,
    idempotencyKeyHeader: unknown,
    input: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    const idempotencyKey = this.validateIdempotencyKey(idempotencyKeyHeader);
    const orderId = input?.orderId;
    if (typeof orderId !== 'string') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A valid orderId is required.' });
    }
    const method = this.normalizeMethod(input?.method);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ orderId, method }))
      .digest('hex');

    const started = await this.beginAttempt(userId, idempotencyKey, fingerprint, orderId, method);
    if (started.action === 'replay') return this.toResponse(started.attempt, started.orderStatus);

    let gatewayResult: GatewayPaymentResult;
    const gatewayRequest: GatewayChargeRequest = {
      orderId: started.attempt.orderId,
      paymentAttemptId: started.attempt.id,
      amount: started.attempt.amount,
      currency: 'VND',
      method: started.attempt.method,
      gatewayIdempotencyKey: started.attempt.gatewayIdempotencyKey,
    };
    try {
      gatewayResult = started.action === 'charge'
        ? await this.paymentGateway.charge(gatewayRequest)
        : await this.paymentGateway.lookupByIdempotencyKey(started.attempt.gatewayIdempotencyKey);
    } catch {
      // A lost response has an unknown outcome. Never release the reservation here.
      gatewayResult = this.unknownGatewayResult();
    }

    if (gatewayResult.status === 'SUCCESS' || gatewayResult.status === 'FAILED') {
      return this.applyTerminalResult(started.attempt.id, gatewayResult);
    }
    return this.recordNonterminalResult(started.attempt.id, gatewayResult.status);
  }

  private async beginAttempt(
    userId: string,
    idempotencyKey: string,
    fingerprint: string,
    orderId: string,
    method: PaymentMethod,
  ): Promise<StartedAttempt> {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const order = await this.lockOwnedOrder(manager, userId, orderId);
      const paymentRepository = manager.getRepository(PaymentAttempt);
      const existing = await paymentRepository.findOne({ where: { orderId, idempotencyKey } });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'This key was used with a different Order or payment method.' });
        }
        return {
          attempt: existing,
          orderStatus: order.status,
          action: existing.status === PaymentAttemptStatus.SUCCESS || existing.status === PaymentAttemptStatus.FAILED
            ? 'replay'
            : 'lookup',
        };
      }

      const openAttempt = await paymentRepository.createQueryBuilder('attempt')
        .where('attempt.orderId = :orderId', { orderId })
        .andWhere('attempt.status IN (:...statuses)', {
          statuses: [PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.UNKNOWN],
        })
        .orderBy('attempt.createdAt', 'DESC')
        .setLock('pessimistic_write')
        .getOne();
      if (openAttempt) {
        throw new ConflictException({ code: 'PAYMENT_IN_PROGRESS', message: 'Reconcile the existing payment using its original Idempotency-Key.' });
      }

      let reservation: InventoryReservation;
      if (order.status === OrderStatus.PAYMENT_FAILED) {
        const previous = await paymentRepository.createQueryBuilder('attempt')
          .where('attempt.orderId = :orderId', { orderId })
          .orderBy('attempt.createdAt', 'DESC')
          .addOrderBy('attempt.id', 'DESC')
          .setLock('pessimistic_write')
          .getOne();
        if (!previous || previous.status !== PaymentAttemptStatus.FAILED) {
          throw new ConflictException({ code: 'ORDER_NOT_RETRYABLE', message: 'A retry requires the previous attempt to have a confirmed failure.' });
        }
        reservation = await this.inventoryService.reacquireForRetryInTransaction(manager, order.id);
      } else if (order.status === OrderStatus.PENDING) {
        reservation = await this.inventoryService.getLatestReservationInTransaction(manager, order.id);
        if (reservation.status === ReservationStatus.HELD && reservation.expiresAt.getTime() <= Date.now()) {
          throw new ConflictException({ code: 'RESERVATION_EXPIRED', message: 'The stock reservation has expired; create a new Order.' });
        }
        if (reservation.status !== ReservationStatus.HELD) {
          throw new ConflictException({ code: 'INVALID_RESERVATION_STATE', message: 'The Order does not have a HELD reservation available for payment.' });
        }
      } else {
        throw new ConflictException({ code: 'ORDER_NOT_PAYABLE', message: 'This Order is not in a payable state.' });
      }

      if (!Number.isSafeInteger(order.totalAmount) || order.totalAmount < 0) {
        throw new ConflictException({ code: 'PRICE_OVERFLOW', message: 'The Order amount is outside the safe integer VND range.' });
      }
      const gatewayIdempotencyKey = this.gatewayKey(orderId, idempotencyKey);
      const attempt = await paymentRepository.save(paymentRepository.create({
        orderId,
        reservationId: reservation.id,
        idempotencyKey,
        requestFingerprint: fingerprint,
        gatewayIdempotencyKey,
        method,
        status: PaymentAttemptStatus.PROCESSING,
        amount: order.totalAmount,
        currency: 'VND',
        gatewayReference: null,
        failureCode: null,
        failureMessage: null,
        completedAt: null,
      }));
      await this.inventoryService.markPaymentPendingInTransaction(manager, order.id, reservation.id);
      return { attempt, orderStatus: OrderStatus.PENDING, action: 'charge' };
    });
  }

  private async applyTerminalResult(
    paymentAttemptId: string,
    result: GatewayPaymentResult,
  ): Promise<PaymentResponse> {
    const orderId = await this.findAttemptOrderId(paymentAttemptId);
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const attempt = await this.lockAttempt(manager, paymentAttemptId);
      if (attempt.orderId !== order.id) {
        throw new NotFoundException({ code: 'PAYMENT_ATTEMPT_NOT_FOUND', message: 'Payment attempt was not found.' });
      }
      if (attempt.status === PaymentAttemptStatus.SUCCESS || attempt.status === PaymentAttemptStatus.FAILED) {
        return this.toResponse(attempt, order.status);
      }
      if (attempt.status !== PaymentAttemptStatus.PROCESSING && attempt.status !== PaymentAttemptStatus.UNKNOWN) {
        throw new ConflictException({ code: 'PAYMENT_IN_PROGRESS', message: 'The PaymentAttempt is not in a reconcilable state.' });
      }

      const completedAt = new Date();
      const gatewayReference = this.sanitizeGatewayReference(result.gatewayReference);
      if (result.status === 'SUCCESS') {
        await this.inventoryService.consumeAfterPaymentSuccessInTransaction(manager, order.id, attempt.reservationId);
        attempt.status = PaymentAttemptStatus.SUCCESS;
        attempt.gatewayReference = gatewayReference;
        attempt.failureCode = null;
        attempt.failureMessage = null;
      } else {
        await this.inventoryService.releaseAfterConfirmedFailureInTransaction(manager, order.id, attempt.reservationId);
        attempt.status = PaymentAttemptStatus.FAILED;
        attempt.gatewayReference = gatewayReference;
        attempt.failureCode = this.sanitizeFailureCode(result.failureCode);
        attempt.failureMessage = 'Payment was declined by the mock gateway.';
      }
      attempt.completedAt = completedAt;
      const saved = await manager.getRepository(PaymentAttempt).save(attempt);
      return this.toResponse(saved, result.status === 'SUCCESS' ? OrderStatus.PAID : OrderStatus.PAYMENT_FAILED);
    });
  }

  private async recordNonterminalResult(
    paymentAttemptId: string,
    gatewayStatus: 'PROCESSING' | 'UNKNOWN',
  ): Promise<PaymentResponse> {
    const orderId = await this.findAttemptOrderId(paymentAttemptId);
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const attempt = await this.lockAttempt(manager, paymentAttemptId);
      if (attempt.status === PaymentAttemptStatus.SUCCESS || attempt.status === PaymentAttemptStatus.FAILED) {
        return this.toResponse(attempt, order.status);
      }
      attempt.status = gatewayStatus === 'PROCESSING'
        ? PaymentAttemptStatus.PROCESSING
        : PaymentAttemptStatus.UNKNOWN;
      const saved = await manager.getRepository(PaymentAttempt).save(attempt);
      return this.toResponse(saved, order.status);
    });
  }

  private async lockOwnedOrder(manager: EntityManager, userId: string, orderId: string): Promise<Order> {
    const order = await manager.getRepository(Order).createQueryBuilder('order')
      .where('order.id = :orderId', { orderId })
      .andWhere('order.userId = :userId', { userId })
      .setLock('pessimistic_write')
      .getOne();
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' });
    return order;
  }

  private async lockOrder(manager: EntityManager, orderId: string): Promise<Order> {
    const order = await manager.getRepository(Order).createQueryBuilder('order')
      .where('order.id = :orderId', { orderId })
      .setLock('pessimistic_write')
      .getOne();
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' });
    return order;
  }

  private async lockAttempt(manager: EntityManager, id: string): Promise<PaymentAttempt> {
    const attempt = await manager.getRepository(PaymentAttempt).createQueryBuilder('attempt')
      .where('attempt.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!attempt) throw new NotFoundException({ code: 'PAYMENT_ATTEMPT_NOT_FOUND', message: 'Payment attempt was not found.' });
    return attempt;
  }

  private async findAttemptOrderId(paymentAttemptId: string): Promise<string> {
    const attempt = await this.dataSource.getRepository(PaymentAttempt).findOne({
      where: { id: paymentAttemptId },
      select: { id: true, orderId: true },
    });
    if (!attempt) throw new NotFoundException({ code: 'PAYMENT_ATTEMPT_NOT_FOUND', message: 'Payment attempt was not found.' });
    return attempt.orderId;
  }

  private validateIdempotencyKey(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: `Idempotency-Key must contain 1-${IDEMPOTENCY_KEY_MAX_LENGTH} characters.` });
    }
    return value.trim();
  }

  private normalizeMethod(value: unknown): PaymentMethod {
    if (typeof value !== 'string') {
      throw new BadRequestException({ code: 'INVALID_PAYMENT_METHOD', message: 'method must be CARD or WALLET.' });
    }
    const normalized = value.trim().toUpperCase();
    if (!Object.values(PaymentMethod).includes(normalized as PaymentMethod)) {
      throw new BadRequestException({ code: 'INVALID_PAYMENT_METHOD', message: 'method must be CARD or WALLET.' });
    }
    return normalized as PaymentMethod;
  }

  private gatewayKey(orderId: string, idempotencyKey: string): string {
    return createHash('sha256').update(`${orderId}:${idempotencyKey}`).digest('hex');
  }

  private sanitizeGatewayReference(reference: string | null): string | null {
    if (typeof reference !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(reference)) return null;
    return reference;
  }

  private sanitizeFailureCode(code: string | null): string {
    return code === 'MOCK_DECLINED' ? code : 'PAYMENT_FAILED';
  }

  private unknownGatewayResult(): GatewayPaymentResult {
    return { status: 'UNKNOWN', gatewayReference: null, failureCode: null, failureMessage: null };
  }

  private toResponse(attempt: PaymentAttempt, orderStatus: OrderStatus): PaymentResponse {
    return {
      paymentAttemptId: attempt.id,
      orderId: attempt.orderId,
      reservationId: attempt.reservationId,
      status: attempt.status,
      method: attempt.method,
      amount: attempt.amount,
      currency: attempt.currency,
      gatewayReference: attempt.gatewayReference,
      failureCode: attempt.failureCode,
      createdAt: attempt.createdAt,
      completedAt: attempt.completedAt,
      orderStatus,
    };
  }
}
