import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Product } from '../products/product.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { InventoryReservation, ReservationStatus } from './inventory-reservation.entity';
import { InventoryReservationItem } from './inventory-reservation-item.entity';

const RESERVATION_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class InventoryService {
  constructor(private readonly dataSource: DataSource) {}

  async markPaymentPending(orderId: string, reservationId: string): Promise<InventoryReservation> {
    return this.dataSource.transaction((manager) => this.markPaymentPendingInTransaction(manager, orderId, reservationId));
  }

  async markPaymentPendingInTransaction(
    manager: EntityManager,
    orderId: string,
    reservationId: string,
  ): Promise<InventoryReservation> {
    const order = await this.lockOrder(manager, orderId);
    const reservation = await this.lockReservation(manager, reservationId);
    this.assertReservationOwner(reservation, orderId);
    if (
      reservation.status === ReservationStatus.PAYMENT_PENDING &&
      order.status === OrderStatus.PENDING
    ) return reservation;
    if (
      order.status !== OrderStatus.PENDING ||
      reservation.status !== ReservationStatus.HELD ||
      reservation.expiresAt.getTime() <= Date.now()
    ) {
      throw this.invalidState('Only a pending Order with a HELD reservation can start payment.');
    }
    reservation.status = ReservationStatus.PAYMENT_PENDING;
    return manager.getRepository(InventoryReservation).save(reservation);
  }

  async releaseAfterConfirmedFailure(orderId: string, reservationId: string): Promise<InventoryReservation> {
    return this.dataSource.transaction((manager) => this.releaseAfterConfirmedFailureInTransaction(manager, orderId, reservationId));
  }

  async releaseAfterConfirmedFailureInTransaction(
    manager: EntityManager,
    orderId: string,
    reservationId: string,
  ): Promise<InventoryReservation> {
    const order = await this.lockOrder(manager, orderId);
    const reservation = await this.lockReservation(manager, reservationId);
    this.assertReservationOwner(reservation, orderId);
    if (
      reservation.status === ReservationStatus.RELEASED &&
      order.status === OrderStatus.PAYMENT_FAILED
    ) return reservation;
    if (order.status !== OrderStatus.PENDING || reservation.status !== ReservationStatus.PAYMENT_PENDING) {
      throw this.invalidState('Only a payment-pending reservation can be released after a confirmed failure.');
    }
    await this.restoreStock(manager, reservationId);
    reservation.status = ReservationStatus.RELEASED;
    order.status = OrderStatus.PAYMENT_FAILED;
    await manager.getRepository(InventoryReservation).save(reservation);
    await manager.getRepository(Order).save(order);
    return reservation;
  }

  async consumeAfterPaymentSuccess(orderId: string, reservationId: string): Promise<InventoryReservation> {
    return this.dataSource.transaction((manager) => this.consumeAfterPaymentSuccessInTransaction(manager, orderId, reservationId));
  }

  async consumeAfterPaymentSuccessInTransaction(
    manager: EntityManager,
    orderId: string,
    reservationId: string,
  ): Promise<InventoryReservation> {
    const order = await this.lockOrder(manager, orderId);
    const reservation = await this.lockReservation(manager, reservationId);
    this.assertReservationOwner(reservation, orderId);
    if (
      reservation.status === ReservationStatus.CONSUMED &&
      order.status === OrderStatus.PAID
    ) return reservation;
    if (order.status !== OrderStatus.PENDING || reservation.status !== ReservationStatus.PAYMENT_PENDING) {
      throw this.invalidState('Only a payment-pending reservation can be consumed after success.');
    }
    reservation.status = ReservationStatus.CONSUMED;
    order.status = OrderStatus.PAID;
    await manager.getRepository(InventoryReservation).save(reservation);
    await manager.getRepository(Order).save(order);
    return reservation;
  }

  async reacquireForRetry(orderId: string): Promise<InventoryReservation> {
    return this.dataSource.transaction((manager) => this.reacquireForRetryInTransaction(manager, orderId));
  }

  async reacquireForRetryInTransaction(
    manager: EntityManager,
    orderId: string,
  ): Promise<InventoryReservation> {
      const order = await this.lockOrder(manager, orderId);
      if (order.status !== OrderStatus.PAYMENT_FAILED) {
        if (order.status === OrderStatus.PENDING) {
          const active = await manager.getRepository(InventoryReservation)
            .createQueryBuilder('reservation')
            .where('reservation.orderId = :orderId', { orderId })
            .andWhere('reservation.status = :status', { status: ReservationStatus.HELD })
            .orderBy('reservation.createdAt', 'DESC')
            .setLock('pessimistic_write')
            .getOne();
          if (active && active.expiresAt.getTime() > Date.now()) return active;
        }
        throw new ConflictException({ code: 'ORDER_NOT_RETRYABLE', message: 'Only a PAYMENT_FAILED Order can reacquire stock.' });
      }
      const items = await manager.getRepository(OrderItem).find({ where: { orderId }, order: { productId: 'ASC', id: 'ASC' } });
      if (!items.length) throw this.invalidState('The Order has no items to reacquire.');
      const quantities = this.quantitiesByProduct(items);
      const products = await this.lockProducts(manager, [...quantities.keys()]);
      for (const [productId, quantity] of quantities) {
        const product = products.get(productId);
        if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'A product for this Order no longer exists.' });
        if (product.stock < quantity) {
          throw new ConflictException({ code: 'OUT_OF_STOCK', message: 'There is not enough stock to retry this Order.' });
        }
      }
      for (const [productId, quantity] of quantities) products.get(productId)!.stock -= quantity;
      await manager.getRepository(Product).save([...products.values()]);

      const reservation = await manager.getRepository(InventoryReservation).save(
        manager.getRepository(InventoryReservation).create({
          orderId,
          status: ReservationStatus.HELD,
          expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
        }),
      );
      await manager.getRepository(InventoryReservationItem).save(
        items.map((item) => manager.getRepository(InventoryReservationItem).create({
          reservationId: reservation.id,
          orderItemId: item.id,
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
      order.status = OrderStatus.PENDING;
      await manager.getRepository(Order).save(order);
      return manager.getRepository(InventoryReservation).findOneOrFail({
        where: { id: reservation.id },
        relations: { items: true },
      });
  }

  async getLatestReservationInTransaction(
    manager: EntityManager,
    orderId: string,
  ): Promise<InventoryReservation> {
    const reservation = await manager.getRepository(InventoryReservation)
      .createQueryBuilder('reservation')
      .where('reservation.orderId = :orderId', { orderId })
      .orderBy('reservation.createdAt', 'DESC')
      .addOrderBy('reservation.id', 'DESC')
      .setLock('pessimistic_write')
      .getOne();
    if (!reservation) {
      throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Inventory reservation was not found.' });
    }
    return reservation;
  }

  async expireHeldReservations(now = new Date()): Promise<number> {
    const candidates = await this.dataSource.getRepository(InventoryReservation).createQueryBuilder('reservation')
      .select(['reservation.id', 'reservation.orderId'])
      .where('reservation.status = :status', { status: ReservationStatus.HELD })
      .andWhere('reservation.expiresAt <= :now', { now })
      .orderBy('reservation.expiresAt', 'ASC')
      .limit(100)
      .getMany();
    let expired = 0;
    for (const candidate of candidates) {
      const didExpire = await this.expireOne(candidate.orderId, candidate.id, now);
      if (didExpire) expired += 1;
    }
    return expired;
  }

  async expireOne(orderId: string, reservationId: string, now: Date): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const reservation = await this.lockReservation(manager, reservationId);
      this.assertReservationOwner(reservation, orderId);
      if (
        reservation.status !== ReservationStatus.HELD ||
        reservation.expiresAt.getTime() > now.getTime() ||
        order.status !== OrderStatus.PENDING
      ) return false;
      await this.restoreStock(manager, reservationId);
      reservation.status = ReservationStatus.EXPIRED;
      order.status = OrderStatus.CANCELLED;
      await manager.getRepository(InventoryReservation).save(reservation);
      await manager.getRepository(Order).save(order);
      return true;
    });
  }

  private async restoreStock(manager: EntityManager, reservationId: string): Promise<void> {
    const items = await manager.getRepository(InventoryReservationItem).find({
      where: { reservationId },
      order: { productId: 'ASC' },
    });
    const quantities = new Map<string, number>();
    for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    const products = await this.lockProducts(manager, [...quantities.keys()]);
    for (const [productId, quantity] of quantities) {
      const product = products.get(productId);
      if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'A reserved product no longer exists.' });
      const newStock = product.stock + quantity;
      if (!Number.isSafeInteger(newStock) || newStock > 2147483647) {
        throw this.invalidState('Restoring stock would exceed the database integer range.');
      }
      product.stock = newStock;
    }
    await manager.getRepository(Product).save([...products.values()]);
  }

  private async lockProducts(manager: EntityManager, ids: string[]): Promise<Map<string, Product>> {
    if (ids.length === 0) return new Map();
    const products = await manager.getRepository(Product).createQueryBuilder('product')
      .where('product.id IN (:...ids)', { ids: [...ids].sort() })
      .orderBy('product.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    return new Map(products.map((product) => [product.id, product]));
  }

  private quantitiesByProduct(items: OrderItem[]): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const item of items) {
      const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
      if (!Number.isSafeInteger(quantity) || quantity > 2147483647) {
        throw this.invalidState('Reserved quantity exceeds the database integer range.');
      }
      quantities.set(item.productId, quantity);
    }
    return quantities;
  }

  private async lockOrder(manager: EntityManager, id: string): Promise<Order> {
    const order = await manager.getRepository(Order).createQueryBuilder('order')
      .where('order.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' });
    return order;
  }

  private async lockReservation(manager: EntityManager, id: string): Promise<InventoryReservation> {
    const reservation = await manager.getRepository(InventoryReservation).createQueryBuilder('reservation')
      .where('reservation.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!reservation) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Inventory reservation was not found.' });
    return reservation;
  }

  private assertReservationOwner(reservation: InventoryReservation, orderId: string): void {
    if (reservation.orderId !== orderId) throw this.invalidState('The reservation does not belong to this Order.');
  }

  private invalidState(message: string): ConflictException {
    return new ConflictException({ code: 'INVALID_RESERVATION_STATE', message });
  }
}
