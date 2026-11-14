import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryReservation, ReservationStatus } from '../inventory/inventory-reservation.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { PaymentAttempt, PaymentAttemptStatus, PaymentMethod } from './payment-attempt.entity';
import { GatewayChargeRequest, GatewayPaymentResult, PaymentGateway } from './payment-gateway';
import { PaymentsService } from './payments.service';

const USER_ID = '00000000-0000-4000-8000-000000000031';
const ORDER_ID = '00000000-0000-4000-8000-000000000032';
const RESERVATION_ID = '00000000-0000-4000-8000-000000000033';

describe('PaymentsService', () => {
  it('charges the database Order amount after committing HELD → PAYMENT_PENDING, then atomically consumes on success', async () => {
    const context = makeContext();
    context.gateway.charge.mockImplementation(async (request: GatewayChargeRequest) => {
      expect(context.insideTransaction()).toBe(false);
      expect(request).toMatchObject({ orderId: ORDER_ID, amount: 92000, currency: 'VND', method: PaymentMethod.CARD });
      expect(request.paymentAttemptId).toBeTruthy();
      expect(request.gatewayIdempotencyKey).toMatch(/^[a-f0-9]{64}$/);
      return gatewayResult('SUCCESS');
    });
    const response = await context.service.createOrReplay(USER_ID, 'payment-1', {
      orderId: ORDER_ID,
      method: 'card',
      amount: 1,
    } as never);
    expect(response).toMatchObject({ status: PaymentAttemptStatus.SUCCESS, amount: 92000, currency: 'VND', orderStatus: OrderStatus.PAID, reservationId: RESERVATION_ID });
    expect(context.order.status).toBe(OrderStatus.PAID);
    expect(context.reservation.status).toBe(ReservationStatus.CONSUMED);
    expect(context.stock).toBe(3);
    expect(context.attempts).toHaveLength(1);
    expect(context.attempts[0]).toMatchObject({ amount: 92000, status: PaymentAttemptStatus.SUCCESS, method: PaymentMethod.CARD });
    expect(context.inventory.calls).toContain(`mark:${RESERVATION_ID}`);
    expect(context.inventory.calls).toContain(`consume:${RESERVATION_ID}`);
  });

  it('records confirmed failure once, releases stock, and retries on the same Order with a new key and reservation', async () => {
    const context = makeContext();
    context.gateway.charge.mockResolvedValueOnce(gatewayResult('FAILED'));
    const failed = await context.service.createOrReplay(USER_ID, 'fail-key', { orderId: ORDER_ID, method: 'WALLET' });
    expect(failed).toMatchObject({ status: PaymentAttemptStatus.FAILED, orderStatus: OrderStatus.PAYMENT_FAILED, failureCode: 'MOCK_DECLINED' });
    expect(context.stock).toBe(5);
    const replay = await context.service.createOrReplay(USER_ID, 'fail-key', { orderId: ORDER_ID, method: 'WALLET' });
    expect(replay.paymentAttemptId).toBe(failed.paymentAttemptId);
    expect(context.gateway.charge).toHaveBeenCalledTimes(1);
    expect(context.inventory.calls.filter((call) => call.startsWith('release:'))).toHaveLength(1);

    context.gateway.charge.mockResolvedValueOnce(gatewayResult('SUCCESS'));
    const retried = await context.service.createOrReplay(USER_ID, 'retry-key', { orderId: ORDER_ID, method: 'CARD' });
    expect(retried).toMatchObject({ orderId: ORDER_ID, status: PaymentAttemptStatus.SUCCESS, orderStatus: OrderStatus.PAID });
    expect(retried.paymentAttemptId).not.toBe(failed.paymentAttemptId);
    expect(retried.reservationId).not.toBe(RESERVATION_ID);
    expect(context.attempts[0].reservationId).toBe(RESERVATION_ID);
    expect(context.attempts[1].reservationId).toBe(retried.reservationId);
    expect(context.stock).toBe(3);
  });

  it('keeps UNKNOWN, Order PENDING, and stock reserved until same-key lookup confirms success', async () => {
    const context = makeContext();
    context.gateway.charge.mockResolvedValueOnce(gatewayResult('UNKNOWN'));
    context.gateway.lookupByIdempotencyKey.mockResolvedValueOnce(gatewayResult('UNKNOWN'));
    const unknown = await context.service.createOrReplay(USER_ID, 'same-key', { orderId: ORDER_ID, method: 'CARD' });
    expect(unknown).toMatchObject({ status: PaymentAttemptStatus.UNKNOWN, orderStatus: OrderStatus.PENDING });
    expect(context.stock).toBe(3);
    expect(context.reservation.status).toBe(ReservationStatus.PAYMENT_PENDING);
    const sameAttempt = await context.service.createOrReplay(USER_ID, 'same-key', { orderId: ORDER_ID, method: 'CARD' });
    expect(sameAttempt.paymentAttemptId).toBe(unknown.paymentAttemptId);
    expect(context.gateway.charge).toHaveBeenCalledTimes(1);
    context.gateway.lookupByIdempotencyKey.mockResolvedValueOnce(gatewayResult('SUCCESS'));
    const resolved = await context.service.createOrReplay(USER_ID, 'same-key', { orderId: ORDER_ID, method: 'CARD' });
    expect(resolved).toMatchObject({ paymentAttemptId: unknown.paymentAttemptId, status: PaymentAttemptStatus.SUCCESS, orderStatus: OrderStatus.PAID });
    expect(context.stock).toBe(3);
    expect(context.inventory.calls.filter((call) => call.startsWith('consume:'))).toHaveLength(1);
  });

  it('maps gateway connection errors to UNKNOWN without exposing gateway details', async () => {
    const context = makeContext();
    context.gateway.charge.mockRejectedValue(new Error('secret credential or connection trace'));
    const response = await context.service.createOrReplay(USER_ID, 'network-key', { orderId: ORDER_ID, method: 'CARD' });
    expect(response).toMatchObject({ status: PaymentAttemptStatus.UNKNOWN, orderStatus: OrderStatus.PENDING, failureCode: null });
    expect(JSON.stringify(response)).not.toContain('secret credential');
    expect(context.reservation.status).toBe(ReservationStatus.PAYMENT_PENDING);
    expect(context.stock).toBe(3);
  });

  it('keeps PROCESSING as nonterminal and rejects any new key', async () => {
    const context = makeContext();
    context.gateway.charge.mockResolvedValue(gatewayResult('PROCESSING'));
    const response = await context.service.createOrReplay(USER_ID, 'processing-key', { orderId: ORDER_ID, method: 'CARD' });
    expect(response.status).toBe(PaymentAttemptStatus.PROCESSING);
    await expect(context.service.createOrReplay(USER_ID, 'different-key', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toMatchObject({ response: { code: 'PAYMENT_IN_PROGRESS' } });
    expect(context.attempts).toHaveLength(1);
  });

  it('does not create an attempt with a new key while an old result is PROCESSING or UNKNOWN', async () => {
    const context = makeContext();
    context.gateway.charge.mockResolvedValue(gatewayResult('UNKNOWN'));
    await context.service.createOrReplay(USER_ID, 'original', { orderId: ORDER_ID, method: 'CARD' });
    await expect(context.service.createOrReplay(USER_ID, 'new-key', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toMatchObject({ response: { code: 'PAYMENT_IN_PROGRESS' } });
    expect(context.attempts).toHaveLength(1);
    expect(context.gateway.charge).toHaveBeenCalledTimes(1);
  });

  it('replays terminal results and rejects reuse of a key with a different method', async () => {
    const context = makeContext();
    context.gateway.charge.mockResolvedValue(gatewayResult('SUCCESS'));
    const first = await context.service.createOrReplay(USER_ID, 'fixed', { orderId: ORDER_ID, method: 'CARD' });
    await expect(context.service.createOrReplay(USER_ID, 'fixed', { orderId: ORDER_ID, method: 'CARD' }))
      .resolves.toMatchObject({ paymentAttemptId: first.paymentAttemptId, status: PaymentAttemptStatus.SUCCESS });
    await expect(context.service.createOrReplay(USER_ID, 'fixed', { orderId: ORDER_ID, method: 'WALLET' }))
      .rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(context.gateway.charge).toHaveBeenCalledTimes(1);
    expect(context.gateway.lookupByIdempotencyKey).not.toHaveBeenCalled();
  });

  it('validates the key, method, ownership, payable status, and reservation expiry', async () => {
    const context = makeContext();
    await expect(context.service.createOrReplay(USER_ID, '   ', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(context.service.createOrReplay(USER_ID, 'k', { orderId: ORDER_ID, method: 'PAYPAL' }))
      .rejects.toMatchObject({ response: { code: 'INVALID_PAYMENT_METHOD' } });
    await expect(context.service.createOrReplay('other-user', 'k', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toBeInstanceOf(NotFoundException);
    context.order.status = OrderStatus.CANCELLED;
    await expect(context.service.createOrReplay(USER_ID, 'cancelled', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toMatchObject({ response: { code: 'ORDER_NOT_PAYABLE' } });
    context.order.status = OrderStatus.PAID;
    await expect(context.service.createOrReplay(USER_ID, 'paid', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toMatchObject({ response: { code: 'ORDER_NOT_PAYABLE' } });
    context.order.status = OrderStatus.PENDING;
    context.reservation.expiresAt = new Date(Date.now() - 1000);
    await expect(context.service.createOrReplay(USER_ID, 'expired', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toMatchObject({ response: { code: 'RESERVATION_EXPIRED' } });
    expect(context.attempts).toHaveLength(0);
    expect(context.gateway.charge).not.toHaveBeenCalled();
  });

  it('rejects an unsafe Order amount before creating an attempt or calling the gateway', async () => {
    const context = makeContext();
    context.order.totalAmount = Number.MAX_SAFE_INTEGER + 1;
    await expect(context.service.createOrReplay(USER_ID, 'unsafe-amount', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toMatchObject({ response: { code: 'PRICE_OVERFLOW' } });
    expect(context.attempts).toHaveLength(0);
    expect(context.gateway.charge).not.toHaveBeenCalled();
  });

  it('rolls back an attempt and retry reservation when reacquire has no stock', async () => {
    const context = makeContext();
    context.gateway.charge.mockResolvedValueOnce(gatewayResult('FAILED'));
    await context.service.createOrReplay(USER_ID, 'first', { orderId: ORDER_ID, method: 'CARD' });
    context.inventory.stock = 0;
    const count = context.attempts.length;
    await expect(context.service.createOrReplay(USER_ID, 'retry', { orderId: ORDER_ID, method: 'CARD' }))
      .rejects.toMatchObject({ response: { code: 'OUT_OF_STOCK' } });
    expect(context.attempts).toHaveLength(count);
    expect(context.order.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(context.gateway.charge).toHaveBeenCalledTimes(1);
  });

  it('does not downgrade a terminal result when a duplicate late result is applied', async () => {
    const context = makeContext();
    context.gateway.charge.mockResolvedValue(gatewayResult('SUCCESS'));
    const paid = await context.service.createOrReplay(USER_ID, 'terminal', { orderId: ORDER_ID, method: 'CARD' });
    const latest = context.attempts[0];
    latest.status = PaymentAttemptStatus.SUCCESS;
    const replay = await context.service.createOrReplay(USER_ID, 'terminal', { orderId: ORDER_ID, method: 'CARD' });
    expect(replay).toMatchObject({ paymentAttemptId: paid.paymentAttemptId, status: PaymentAttemptStatus.SUCCESS, orderStatus: OrderStatus.PAID });
  });
});

function gatewayResult(status: GatewayPaymentResult['status']): GatewayPaymentResult {
  return {
    status,
    gatewayReference: status === 'SUCCESS' || status === 'FAILED' ? 'mock-reference' : null,
    failureCode: status === 'FAILED' ? 'MOCK_DECLINED' : null,
    failureMessage: status === 'FAILED' ? 'decline' : null,
  };
}

function makeContext() {
  const order = { id: ORDER_ID, userId: USER_ID, status: OrderStatus.PENDING, totalAmount: 92000 } as Order;
  let reservation: InventoryReservation = {
    id: RESERVATION_ID,
    orderId: ORDER_ID,
    status: ReservationStatus.HELD,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  } as InventoryReservation;
  const attempts: PaymentAttempt[] = [];
  let stock = 3;
  let inTransaction = false;
  let transactions = 0;
  const calls: string[] = [];
  const paymentRepo = {
    create: (input: Partial<PaymentAttempt>) => input,
    save: jest.fn(async (input: Partial<PaymentAttempt>) => {
      let attempt = input.id ? attempts.find(({ id }) => id === input.id) : undefined;
      if (!attempt) {
        attempt = Object.assign({}, input, {
          id: `attempt-${attempts.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as PaymentAttempt;
        attempts.push(attempt);
      } else {
        Object.assign(attempt, input, { updatedAt: new Date() });
      }
      return attempt;
    }),
    findOne: jest.fn(async ({ where }: { where: Record<string, string> }) => {
      return attempts.find((attempt) => Object.entries(where).every(([key, value]) => (attempt as unknown as Record<string, unknown>)[key] === value)) ?? null;
    }),
    createQueryBuilder: () => {
      const clauses: Array<{ sql: string; params?: Record<string, unknown> }> = [];
      const builder = {
        where: (sql: string, params?: Record<string, unknown>) => { clauses.push({ sql, params }); return builder; },
        andWhere: (sql: string, params?: Record<string, unknown>) => { clauses.push({ sql, params }); return builder; },
        orderBy: () => builder,
        addOrderBy: () => builder,
        setLock: () => builder,
        getOne: async () => {
          const byId = clauses.find(({ sql }) => sql.includes('attempt.id'))?.params?.id;
          if (byId) return attempts.find(({ id }) => id === byId) ?? null;
          const orderId = clauses.find(({ sql }) => sql.includes('attempt.orderId'))?.params?.orderId;
          const statuses = clauses.find(({ sql }) => sql.includes('attempt.status'))?.params?.statuses as PaymentAttemptStatus[] | undefined;
          const matching = attempts.filter((attempt) => attempt.orderId === orderId && (!statuses || statuses.includes(attempt.status)));
          return matching.at(-1) ?? null;
        },
      };
      return builder;
    },
  };
  const orderRepo = {
    createQueryBuilder: () => {
      const clauses: Array<{ sql: string; params?: Record<string, unknown> }> = [];
      const builder = {
        where: (sql: string, params?: Record<string, unknown>) => { clauses.push({ sql, params }); return builder; },
        andWhere: (sql: string, params?: Record<string, unknown>) => { clauses.push({ sql, params }); return builder; },
        setLock: () => builder,
        getOne: async () => {
          const id = clauses.find(({ sql }) => sql.includes('order.id'))?.params?.orderId;
          const userId = clauses.find(({ sql }) => sql.includes('order.userId'))?.params?.userId;
          return id === order.id && (userId === undefined || userId === order.userId) ? order : null;
        },
      };
      return builder;
    },
  };
  const repositoryByEntity = new Map<unknown, unknown>([[PaymentAttempt, paymentRepo], [Order, orderRepo]]);
  const manager = { getRepository: (entity: unknown) => repositoryByEntity.get(entity) };
  const dataSource = {
    transaction: async (...args: unknown[]) => {
      const callback = args.at(-1) as (manager: EntityManager) => Promise<unknown>;
      transactions += 1;
      inTransaction = true;
      try { return await callback(manager as unknown as EntityManager); }
      finally { inTransaction = false; }
    },
    getRepository: () => ({
      findOne: async ({ where }: { where: Record<string, string> }) => attempts.find((attempt) =>
        Object.entries(where).every(([key, value]) => (attempt as unknown as Record<string, unknown>)[key] === value),
      ) ?? null,
    }),
  };
  const inventory = {
    calls,
    getLatestReservationInTransaction: async (_manager: EntityManager, orderId: string) => {
      if (orderId !== ORDER_ID) throw new NotFoundException();
      return reservation;
    },
    markPaymentPendingInTransaction: async (_manager: EntityManager, orderId: string, reservationId: string) => {
      if (reservation.id !== reservationId || reservation.orderId !== orderId || reservation.status !== ReservationStatus.HELD || reservation.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException({ code: 'RESERVATION_EXPIRED', message: 'The reservation cannot start payment.' });
      }
      reservation.status = ReservationStatus.PAYMENT_PENDING;
      calls.push(`mark:${reservationId}`);
      return reservation;
    },
    consumeAfterPaymentSuccessInTransaction: async (_manager: EntityManager, orderId: string, reservationId: string) => {
      if (reservation.id !== reservationId || reservation.orderId !== orderId || reservation.status !== ReservationStatus.PAYMENT_PENDING) {
        throw new ConflictException({ code: 'INVALID_RESERVATION_STATE', message: 'Attempt reservation is not payable.' });
      }
      reservation.status = ReservationStatus.CONSUMED;
      order.status = OrderStatus.PAID;
      calls.push(`consume:${reservationId}`);
      return reservation;
    },
    releaseAfterConfirmedFailureInTransaction: async (_manager: EntityManager, orderId: string, reservationId: string) => {
      if (reservation.id !== reservationId || reservation.orderId !== orderId || reservation.status !== ReservationStatus.PAYMENT_PENDING) {
        throw new ConflictException({ code: 'INVALID_RESERVATION_STATE', message: 'Attempt reservation is not releasable.' });
      }
      reservation.status = ReservationStatus.RELEASED;
      order.status = OrderStatus.PAYMENT_FAILED;
      stock += 2;
      calls.push(`release:${reservationId}`);
      return reservation;
    },
    reacquireForRetryInTransaction: async (_manager: EntityManager, orderId: string) => {
      if (orderId !== ORDER_ID || order.status !== OrderStatus.PAYMENT_FAILED) throw new ConflictException({ code: 'ORDER_NOT_RETRYABLE', message: 'not retryable' });
      if (stock < 2) throw new ConflictException({ code: 'OUT_OF_STOCK', message: 'insufficient' });
      stock -= 2;
      reservation = {
        id: `reservation-${attempts.length + 1}`,
        orderId: ORDER_ID,
        status: ReservationStatus.HELD,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      } as InventoryReservation;
      order.status = OrderStatus.PENDING;
      calls.push(`reacquire:${reservation.id}`);
      return reservation;
    },
  };
  const gateway = {
    charge: jest.fn<Promise<GatewayPaymentResult>, [GatewayChargeRequest]>().mockResolvedValue(gatewayResult('SUCCESS')),
    lookupByIdempotencyKey: jest.fn<Promise<GatewayPaymentResult>, [string]>().mockResolvedValue(gatewayResult('UNKNOWN')),
  };
  return {
    service: new PaymentsService(dataSource as never, inventory as unknown as InventoryService, gateway as unknown as PaymentGateway),
    order,
    get reservation() { return reservation; },
    set reservation(value: InventoryReservation) { reservation = value; },
    attempts,
    gateway,
    inventory: { ...inventory, get stock() { return stock; }, set stock(value: number) { stock = value; } },
    get stock() { return stock; },
    insideTransaction: () => inTransaction,
    get transactions() { return transactions; },
  };
}
