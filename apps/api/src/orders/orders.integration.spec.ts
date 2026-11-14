import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CreateProductBaseline1760000000000 } from '../database/migrations/1760000000000-create-product-baseline';
import { CreateUsersTable1761000000000 } from '../database/migrations/1761000000000-create-users-table';
import { CreateOrdersInventory1762000000000 } from '../database/migrations/1762000000000-create-orders-inventory';
import { InventoryReservation } from '../inventory/inventory-reservation.entity';
import { InventoryReservationItem } from '../inventory/inventory-reservation-item.entity';
import { PricingService } from '../pricing/pricing.service';
import { Product } from '../products/product.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrdersService } from './orders.service';
import { User } from '../users/user.entity';
import { DEMO_PRODUCTS, seedDemoProducts } from '../products/demo-products.seed';

const integrationDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integrationDescribe('Orders PostgreSQL transaction and concurrency integration', () => {
  let dataSource: DataSource;
  let service: OrdersService;
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: process.env.TEST_DATABASE_URL,
      entities: [Product, User, Order, OrderItem, InventoryReservation, InventoryReservationItem],
      migrations: [CreateProductBaseline1760000000000, CreateUsersTable1761000000000, CreateOrdersInventory1762000000000],
      synchronize: false,
      migrationsRun: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    service = new OrdersService(dataSource, new PricingService());
  }, 60_000);

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    for (const userId of createdUserIds) {
      const orders = await dataSource.getRepository(Order).findBy({ userId });
      const orderIds = orders.map(({ id }) => id);
      if (orderIds.length) {
        await dataSource.query('DELETE FROM "inventory_reservation_items" WHERE "reservationId" IN (SELECT "id" FROM "inventory_reservations" WHERE "orderId" = ANY($1::uuid[]))', [orderIds]);
        await dataSource.query('DELETE FROM "inventory_reservations" WHERE "orderId" = ANY($1::uuid[])', [orderIds]);
        await dataSource.query('DELETE FROM "order_items" WHERE "orderId" = ANY($1::uuid[])', [orderIds]);
        await dataSource.getRepository(Order).delete(orderIds);
      }
      await dataSource.getRepository(User).delete(userId);
    }
    for (const productId of createdProductIds) await dataSource.getRepository(Product).delete(productId);
    await dataSource.destroy();
  }, 60_000);

  it('uses the idempotency unique constraint so concurrent identical requests hold stock once', async () => {
    const userId = await createUser();
    const productId = await createProduct(5);
    const payload = { items: [{ productId, quantity: 2, sizeCode: 'M', toppingIds: ['pearls'] }] };
    const [first, second] = await Promise.all([
      service.create(userId, 'concurrent-idempotency', payload),
      service.create(userId, 'concurrent-idempotency', payload),
    ]);
    expect(first.id).toBe(second.id);
    expect(await dataSource.getRepository(Product).findOneByOrFail({ id: productId })).toMatchObject({ stock: 3 });
    expect(await dataSource.getRepository(Order).countBy({ userId })).toBe(1);
  }, 30_000);

  it('serializes different orders and never oversells the final stock unit', async () => {
    const userId = await createUser();
    const productId = await createProduct(1);
    const payload = { items: [{ productId, quantity: 1, sizeCode: 'S', toppingIds: [] }] };
    const results = await Promise.allSettled([
      service.create(userId, randomUUID(), payload),
      service.create(userId, randomUUID(), payload),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await dataSource.getRepository(Product).findOneByOrFail({ id: productId })).toMatchObject({ stock: 0 });
    expect(await dataSource.getRepository(Order).countBy({ userId })).toBe(1);
  }, 30_000);

  it('runs the nine Product seed idempotently against PostgreSQL and rolls back its verification fixtures', async () => {
    await expect(dataSource.transaction(async (manager) => {
      const firstRun = await seedDemoProducts(manager);
      const secondRun = await seedDemoProducts(manager);
      expect(firstRun.inserted.length + firstRun.alreadyPresent.length + firstRun.conflicts.length).toBe(9);
      expect(secondRun.inserted).toHaveLength(0);
      expect(secondRun.alreadyPresent.length + secondRun.conflicts.length).toBe(9);
      throw new Error('Rollback seed verification fixtures.');
    })).rejects.toThrow('Rollback seed verification fixtures.');
  }, 30_000);

  it('does not duplicate or overwrite a same-name Product with another ID', async () => {
    const demo = DEMO_PRODUCTS[0];
    const existingId = randomUUID();
    await expect(dataSource.transaction(async (manager) => {
      await manager.insert(Product, {
        ...demo,
        id: existingId,
        name: `  ${demo.name.toUpperCase()}  `,
        basePrice: 12345,
        stock: 7,
      });
      const result = await seedDemoProducts(manager);
      expect(result.conflicts).toContainEqual({ name: demo.name, existingId });
      const sameName = await manager.query(
        'SELECT id FROM product WHERE lower(btrim(name)) = lower(btrim($1))',
        [demo.name],
      ) as Array<{ id: string }>;
      expect(sameName).toHaveLength(1);
      expect(await manager.findOneBy(Product, { id: existingId })).toMatchObject({ basePrice: 12345, stock: 7 });
      throw new Error('Rollback conflicting seed fixture.');
    })).rejects.toThrow('Rollback conflicting seed fixture.');
  }, 30_000);

  async function createUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.getRepository(User).insert({ id, email: `${id}@integration.example`, fullName: 'Integration User', passwordHash: 'not-a-real-password-hash' });
    createdUserIds.push(id);
    return id;
  }

  async function createProduct(stock: number): Promise<string> {
    const id = randomUUID();
    await dataSource.getRepository(Product).insert({ id, name: 'Integration Product', basePrice: 35000, stock, imageUrl: null });
    createdProductIds.push(id);
    return id;
  }
});
