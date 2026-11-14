import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { CreateProductBaseline1760000000000 } from '../database/migrations/1760000000000-create-product-baseline';
import { CreateUsersTable1761000000000 } from '../database/migrations/1761000000000-create-users-table';
import { CreateOrdersInventory1762000000000 } from '../database/migrations/1762000000000-create-orders-inventory';
import { CreatePaymentAttempts1763000000000 } from '../database/migrations/1763000000000-create-payment-attempts';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryReservation, ReservationStatus } from '../inventory/inventory-reservation.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { OrdersService } from '../orders/orders.service';
import { InventoryReservationItem } from '../inventory/inventory-reservation-item.entity';
import { PaymentAttempt, PaymentAttemptStatus } from './payment-attempt.entity';
import { MockPaymentGateway } from './mock-payment.gateway';
import { PaymentGateway, GatewayChargeRequest, GatewayPaymentResult } from './payment-gateway';
import { PaymentsService } from './payments.service';
import { PricingService } from '../pricing/pricing.service';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';

const integrationDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integrationDescribe('Payments PostgreSQL workflow integration', () => {
  let dataSource: DataSource;
  let ordersService: OrdersService;
  let inventoryService: InventoryService;
  const userIds: string[] = [];
  const productIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: process.env.TEST_DATABASE_URL,
      entities: [Product, User, Order, OrderItem, InventoryReservation, InventoryReservationItem, PaymentAttempt],
      migrations: [CreateProductBaseline1760000000000, CreateUsersTable1761000000000, CreateOrdersInventory1762000000000, CreatePaymentAttempts1763000000000],
      synchronize: false,
      migrationsRun: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    ordersService = new OrdersService(dataSource, new PricingService());
    inventoryService = new InventoryService(dataSource);
  }, 60_000);

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    for (const userId of userIds) {
      const orders = await dataSource.getRepository(Order).findBy({ userId });
      const orderIds = orders.map(({ id }) => id);
      if (orderIds.length) {
        await dataSource.getRepository(PaymentAttempt).delete({ orderId: In(orderIds) });
        await dataSource.query('DELETE FROM "inventory_reservation_items" WHERE "reservationId" IN (SELECT "id" FROM "inventory_reservations" WHERE "orderId" = ANY($1::uuid[]))', [orderIds]);
        await dataSource.query('DELETE FROM "inventory_reservations" WHERE "orderId" = ANY($1::uuid[])', [orderIds]);
        await dataSource.query('DELETE FROM "order_items" WHERE "orderId" = ANY($1::uuid[])', [orderIds]);
        await dataSource.getRepository(Order).delete(orderIds);
      }
      await dataSource.getRepository(User).delete(userId);
    }
    for (const productId of productIds) await dataSource.getRepository(Product).delete(productId);
    await dataSource.destroy();
  }, 60_000);

  it('serializes concurrent same-key requests and creates one charge/attempt', async () => {
    const { userId, orderId } = await createReservedOrder();
    const gateway = new MockPaymentGateway({ result: 'success', timeout: false });
    const payments = new PaymentsService(dataSource, inventoryService, gateway);
    const [first, second] = await Promise.all([
      payments.createOrReplay(userId, 'same-payment-key', { orderId, method: 'CARD' }),
      payments.createOrReplay(userId, 'same-payment-key', { orderId, method: 'CARD' }),
    ]);
    expect(first.paymentAttemptId).toBe(second.paymentAttemptId);
    expect(await dataSource.getRepository(PaymentAttempt).countBy({ orderId })).toBe(1);
    expect(await dataSource.getRepository(Order).findOneByOrFail({ id: orderId })).toMatchObject({ status: OrderStatus.PAID });
  }, 30_000);

  it('blocks a second key while the first Gateway result is still pending', async () => {
    const { userId, orderId } = await createReservedOrder();
    let signalStarted!: () => void;
    let resolveCharge!: (result: GatewayPaymentResult) => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const gateway: PaymentGateway = {
      charge: async (_request: GatewayChargeRequest) => {
        signalStarted();
        return new Promise<GatewayPaymentResult>((resolve) => { resolveCharge = resolve; });
      },
      lookupByIdempotencyKey: async () => ({ status: 'UNKNOWN', gatewayReference: null, failureCode: null, failureMessage: null }),
    };
    const payments = new PaymentsService(dataSource, inventoryService, gateway);
    const firstPromise = payments.createOrReplay(userId, 'first-open-key', { orderId, method: 'CARD' });
    await started;
    await expect(payments.createOrReplay(userId, 'second-open-key', { orderId, method: 'WALLET' }))
      .rejects.toMatchObject({ response: { code: 'PAYMENT_IN_PROGRESS' } });
    resolveCharge({ status: 'SUCCESS', gatewayReference: 'mock-finish', failureCode: null, failureMessage: null });
    await expect(firstPromise).resolves.toMatchObject({ status: PaymentAttemptStatus.SUCCESS });
    expect(await dataSource.getRepository(PaymentAttempt).countBy({ orderId })).toBe(1);
  }, 30_000);

  it('locks shared stock while two failed Orders retry at the same time', async () => {
    const firstUserId = await createUser();
    const secondUserId = await createUser();
    const productId = randomUUID();
    await dataSource.getRepository(Product).insert({ id: productId, name: 'Shared Retry Product', basePrice: 20000, stock: 10, imageUrl: null });
    productIds.push(productId);
    const firstOrder = await ordersService.create(firstUserId, randomUUID(), { items: [{ productId, quantity: 2, sizeCode: 'S', toppingIds: [] }] });
    const secondOrder = await ordersService.create(secondUserId, randomUUID(), { items: [{ productId, quantity: 2, sizeCode: 'S', toppingIds: [] }] });
    const failingGateway = new MockPaymentGateway({ result: 'failure', timeout: false });
    await new PaymentsService(dataSource, inventoryService, failingGateway).createOrReplay(firstUserId, 'first-failure', { orderId: firstOrder.id, method: 'CARD' });
    await new PaymentsService(dataSource, inventoryService, failingGateway).createOrReplay(secondUserId, 'second-failure', { orderId: secondOrder.id, method: 'CARD' });
    await dataSource.getRepository(Product).update(productId, { stock: 2 });

    const retryGateway = new MockPaymentGateway({ result: 'success', timeout: false });
    const results = await Promise.allSettled([
      new PaymentsService(dataSource, inventoryService, retryGateway).createOrReplay(firstUserId, 'first-retry', { orderId: firstOrder.id, method: 'WALLET' }),
      new PaymentsService(dataSource, inventoryService, retryGateway).createOrReplay(secondUserId, 'second-retry', { orderId: secondOrder.id, method: 'CARD' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await dataSource.getRepository(Product).findOneByOrFail({ id: productId })).toMatchObject({ stock: 0 });
  }, 30_000);

  it('keeps timeout UNKNOWN reservation out of expiry and reconciles with the original key', async () => {
    const { userId, orderId, productId } = await createReservedOrder();
    const timeoutGateway = new MockPaymentGateway({ result: 'success', timeout: true });
    const timedOutPayments = new PaymentsService(dataSource, inventoryService, timeoutGateway);
    const unknown = await timedOutPayments.createOrReplay(userId, 'timeout-key', { orderId, method: 'WALLET' });
    expect(unknown.status).toBe(PaymentAttemptStatus.UNKNOWN);
    const stockWhileUnknown = (await dataSource.getRepository(Product).findOneByOrFail({ id: productId })).stock;
    expect(await inventoryService.expireHeldReservations(new Date(Date.now() + 20 * 60 * 1000))).toBe(0);
    expect(await dataSource.getRepository(Order).findOneByOrFail({ id: orderId })).toMatchObject({ status: OrderStatus.PENDING });

    const recoveredPayments = new PaymentsService(dataSource, inventoryService, new MockPaymentGateway({ result: 'success', timeout: false }));
    const success = await recoveredPayments.createOrReplay(userId, 'timeout-key', { orderId, method: 'WALLET' });
    expect(success).toMatchObject({ paymentAttemptId: unknown.paymentAttemptId, status: PaymentAttemptStatus.SUCCESS });
    expect((await dataSource.getRepository(Product).findOneByOrFail({ id: productId })).stock).toBe(stockWhileUnknown);
  }, 30_000);

  it('retries a confirmed failure with a new reservation and rolls back a failed atomic completion', async () => {
    const first = await createReservedOrder();
    const failedPayments = new PaymentsService(dataSource, inventoryService, new MockPaymentGateway({ result: 'failure', timeout: false }));
    const failure = await failedPayments.createOrReplay(first.userId, 'failure-key', { orderId: first.orderId, method: 'CARD' });
    expect(failure.status).toBe(PaymentAttemptStatus.FAILED);
    const oldReservationId = failure.reservationId;
    const retryPayments = new PaymentsService(dataSource, inventoryService, new MockPaymentGateway({ result: 'success', timeout: false }));
    const success = await retryPayments.createOrReplay(first.userId, 'retry-key', { orderId: first.orderId, method: 'WALLET' });
    expect(success).toMatchObject({ status: PaymentAttemptStatus.SUCCESS, orderStatus: OrderStatus.PAID });
    expect(success.reservationId).not.toBe(oldReservationId);
    expect(await dataSource.getRepository(InventoryReservation).findOneByOrFail({ id: oldReservationId })).toMatchObject({ status: ReservationStatus.RELEASED });

    const second = await createReservedOrder();
    const failingInventory = new InventoryService(dataSource);
    const actualConsume = failingInventory.consumeAfterPaymentSuccessInTransaction.bind(failingInventory);
    jest.spyOn(failingInventory, 'consumeAfterPaymentSuccessInTransaction').mockImplementation(async (...args) => {
      await actualConsume(...args);
      throw new Error('Injected failure after state changes, to verify transaction rollback.');
    });
    const atomicPayments = new PaymentsService(dataSource, failingInventory, new MockPaymentGateway({ result: 'success', timeout: false }));
    await expect(atomicPayments.createOrReplay(second.userId, 'atomic-key', { orderId: second.orderId, method: 'CARD' })).rejects.toThrow();
    const attempt = await dataSource.getRepository(PaymentAttempt).findOneByOrFail({ orderId: second.orderId });
    expect(attempt.status).toBe(PaymentAttemptStatus.PROCESSING);
    expect(await dataSource.getRepository(Order).findOneByOrFail({ id: second.orderId })).toMatchObject({ status: OrderStatus.PENDING });
    expect(await dataSource.getRepository(InventoryReservation).findOneByOrFail({ id: attempt.reservationId })).toMatchObject({ status: ReservationStatus.PAYMENT_PENDING });
    jest.restoreAllMocks();
  }, 30_000);

  async function createReservedOrder() {
    const userId = await createUser();
    const productId = randomUUID();
    await dataSource.getRepository(Product).insert({ id: productId, name: 'Payment Test Product', basePrice: 35000, stock: 10, imageUrl: null });
    productIds.push(productId);
    const order = await ordersService.create(userId, randomUUID(), {
      items: [{ productId, quantity: 2, sizeCode: 'M', toppingIds: [] }],
    });
    return { userId, orderId: order.id, productId };
  }

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    await dataSource.getRepository(User).insert({ id: userId, email: `${userId}@payments.integration`, fullName: 'Payment Test', passwordHash: 'not-a-real-password-hash' });
    userIds.push(userId);
    return userId;
  }
});
