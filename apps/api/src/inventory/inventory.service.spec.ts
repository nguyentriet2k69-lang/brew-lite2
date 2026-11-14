import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Product } from '../products/product.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { InventoryReservation, ReservationStatus } from './inventory-reservation.entity';
import { InventoryReservationItem } from './inventory-reservation-item.entity';
import { InventoryService } from './inventory.service';

const ORDER_ID = '00000000-0000-4000-8000-000000000021';
const RESERVATION_ID = '00000000-0000-4000-8000-000000000022';
const PRODUCT_ID = '00000000-0000-4000-8000-000000000023';

describe('InventoryService', () => {
  it('moves HELD to PAYMENT_PENDING idempotently', async () => {
    const context = makeContext();
    await context.service.markPaymentPending(ORDER_ID, RESERVATION_ID);
    await context.service.markPaymentPending(ORDER_ID, RESERVATION_ID);
    expect(context.reservation.status).toBe(ReservationStatus.PAYMENT_PENDING);
    expect(context.reservationSave).toHaveBeenCalledTimes(1);
  });

  it('releases stock once after confirmed payment failure', async () => {
    const context = makeContext({ reservationStatus: ReservationStatus.PAYMENT_PENDING });
    await context.service.releaseAfterConfirmedFailure(ORDER_ID, RESERVATION_ID);
    await context.service.releaseAfterConfirmedFailure(ORDER_ID, RESERVATION_ID);
    expect(context.product.stock).toBe(2);
    expect(context.reservation.status).toBe(ReservationStatus.RELEASED);
    expect(context.order.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(context.productSave).toHaveBeenCalledTimes(1);
  });

  it('consumes stock without restoring it after confirmed success', async () => {
    const context = makeContext({ reservationStatus: ReservationStatus.PAYMENT_PENDING });
    await context.service.consumeAfterPaymentSuccess(ORDER_ID, RESERVATION_ID);
    expect(context.product.stock).toBe(0);
    expect(context.reservation.status).toBe(ReservationStatus.CONSUMED);
    expect(context.order.status).toBe(OrderStatus.PAID);
    expect(context.productSave).not.toHaveBeenCalled();
  });

  it('reacquires stock for retry using the same Order and creates a new 15-minute reservation', async () => {
    const context = makeContext({ orderStatus: OrderStatus.PAYMENT_FAILED, reservationStatus: ReservationStatus.RELEASED, stock: 2 });
    const reservation = await context.service.reacquireForRetry(ORDER_ID);
    const repeated = await context.service.reacquireForRetry(ORDER_ID);
    expect(reservation.id).toBe('retry-reservation');
    expect(repeated.id).toBe('retry-reservation');
    expect(reservation.status).toBe(ReservationStatus.HELD);
    expect(reservation.expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    expect(context.order.status).toBe(OrderStatus.PENDING);
    expect(context.product.stock).toBe(0);
  });

  it('keeps PAYMENT_FAILED and stock unchanged when retry has insufficient inventory', async () => {
    const context = makeContext({ orderStatus: OrderStatus.PAYMENT_FAILED, stock: 1 });
    await expect(context.service.reacquireForRetry(ORDER_ID)).rejects.toMatchObject({ response: { code: 'OUT_OF_STOCK' } });
    expect(context.order.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(context.product.stock).toBe(1);
  });

  it('expires HELD stock once and cancels the pending Order', async () => {
    const context = makeContext({ expiresAt: new Date('2020-01-01T00:00:00Z') });
    const now = new Date('2020-01-01T00:01:00Z');
    expect(await context.service.expireOne(ORDER_ID, RESERVATION_ID, now)).toBe(true);
    expect(await context.service.expireOne(ORDER_ID, RESERVATION_ID, now)).toBe(false);
    expect(context.product.stock).toBe(2);
    expect(context.reservation.status).toBe(ReservationStatus.EXPIRED);
    expect(context.order.status).toBe(OrderStatus.CANCELLED);
    expect(context.productSave).toHaveBeenCalledTimes(1);
  });

  it('never auto releases PAYMENT_PENDING or unexpired HELD reservations', async () => {
    const payment = makeContext({ reservationStatus: ReservationStatus.PAYMENT_PENDING });
    expect(await payment.service.expireOne(ORDER_ID, RESERVATION_ID, new Date('2030-01-01'))).toBe(false);
    const held = makeContext({ expiresAt: new Date('2030-01-02') });
    expect(await held.service.expireOne(ORDER_ID, RESERVATION_ID, new Date('2030-01-01'))).toBe(false);
    expect(payment.product.stock).toBe(0);
    expect(held.product.stock).toBe(0);
  });

  it('rejects invalid transitions and cannot start payment after expiry', async () => {
    const consumed = makeContext({ reservationStatus: ReservationStatus.CONSUMED, orderStatus: OrderStatus.PAID });
    await expect(consumed.service.releaseAfterConfirmedFailure(ORDER_ID, RESERVATION_ID)).rejects.toBeInstanceOf(ConflictException);
    const old = makeContext({ expiresAt: new Date('2020-01-01T00:00:00Z') });
    await expect(old.service.markPaymentPending(ORDER_ID, RESERVATION_ID)).rejects.toMatchObject({ response: { code: 'INVALID_RESERVATION_STATE' } });
  });
});

function makeContext(options: {
  orderStatus?: OrderStatus;
  reservationStatus?: ReservationStatus;
  expiresAt?: Date;
  stock?: number;
} = {}) {
  const order = { id: ORDER_ID, status: options.orderStatus ?? OrderStatus.PENDING } as Order;
  const reservation = {
    id: RESERVATION_ID,
    orderId: ORDER_ID,
    status: options.reservationStatus ?? ReservationStatus.HELD,
    expiresAt: options.expiresAt ?? new Date('2030-01-01T00:00:00Z'),
  } as InventoryReservation;
  const product = { id: PRODUCT_ID, stock: options.stock ?? 0 } as Product;
  const reservationItems = [{ reservationId: RESERVATION_ID, productId: PRODUCT_ID, quantity: 2 }] as InventoryReservationItem[];
  const orderItems = [{ id: 'item-id', orderId: ORDER_ID, productId: PRODUCT_ID, quantity: 2 }] as OrderItem[];
  const orderRepo = {
    createQueryBuilder: () => {
      const qb = { where: () => qb, setLock: () => qb, getOne: async () => order };
      return qb;
    },
    save: jest.fn(async (value: Order) => value),
  };
  const reservationRepo = {
    createQueryBuilder: () => {
      const qb = { where: () => qb, andWhere: () => qb, orderBy: () => qb, setLock: () => qb, getOne: async () => reservation };
      return qb;
    },
    save: jest.fn(async (value: InventoryReservation) => {
      Object.assign(reservation, value);
      if (!reservation.id || reservation.id === RESERVATION_ID) reservation.id = 'retry-reservation';
      return reservation;
    }),
    create: (value: Partial<InventoryReservation>) => value as InventoryReservation,
    findOneOrFail: async () => Object.assign({}, reservation, { id: 'retry-reservation', status: ReservationStatus.HELD, expiresAt: new Date(Date.now() + 15 * 60 * 1000) }),
  };
  const reservationItemRepo = {
    find: async () => reservationItems,
    create: (value: Partial<InventoryReservationItem>) => value,
    save: async (items: Partial<InventoryReservationItem>[]) => items,
  };
  const productRepo = {
    createQueryBuilder: () => {
      const qb = { where: () => qb, orderBy: () => qb, setLock: () => qb, getMany: async () => [product] };
      return qb;
    },
    save: jest.fn(async (products: Product[]) => products),
  };
  const orderItemRepo = { find: async () => orderItems };
  const repoMap = new Map<unknown, unknown>([
    [Order, orderRepo], [InventoryReservation, reservationRepo],
    [InventoryReservationItem, reservationItemRepo], [Product, productRepo], [OrderItem, orderItemRepo],
  ]);
  const manager = { getRepository: (entity: unknown) => repoMap.get(entity) };
  const dataSource = { transaction: async (callback: (manager: EntityManager) => Promise<unknown>) => callback(manager as unknown as EntityManager) };
  return {
    service: new InventoryService(dataSource as never), order, reservation, product,
    reservationSave: reservationRepo.save, productSave: productRepo.save,
  };
}
