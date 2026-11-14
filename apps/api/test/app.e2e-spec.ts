import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import AppDataSource from '../src/data-source';
import { InventoryReservation } from '../src/inventory/inventory-reservation.entity';
import { Order } from '../src/orders/order.entity';
import { OrderItem } from '../src/orders/order-item.entity';
import { PaymentAttempt } from '../src/payments/payment-attempt.entity';
import { seedDemoProducts } from '../src/products/demo-products.seed';
import { Product } from '../src/products/product.entity';
import { User } from '../src/users/user.entity';

interface AuthResponse {
  accessToken: string;
  user: { id: string; fullName: string; email: string };
}

describe('BrewLite checkout (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let productId: string;
  let customerEmail: string;

  beforeAll(async () => {
    dataSource = AppDataSource;
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.transaction((manager) => seedDemoProducts(manager));

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 60_000);

  afterAll(async () => {
    try {
      if (app) {
        await app.close();
      }
      if (!dataSource?.isInitialized) return;

      if (customerEmail) {
        const user = await dataSource.getRepository(User).findOneBy({
          email: customerEmail,
        });
        if (user) {
          const orders = await dataSource
            .getRepository(Order)
            .findBy({ userId: user.id });
          const orderIds = orders.map(({ id }) => id);
          if (orderIds.length > 0) {
            await dataSource
              .getRepository(PaymentAttempt)
              .delete({ orderId: In(orderIds) });
            await dataSource.query(
              'DELETE FROM "inventory_reservation_items" WHERE "reservationId" IN (SELECT "id" FROM "inventory_reservations" WHERE "orderId" = ANY($1::uuid[]))',
              [orderIds],
            );
            await dataSource
              .getRepository(InventoryReservation)
              .delete({ orderId: In(orderIds) });
            await dataSource
              .getRepository(OrderItem)
              .delete({ orderId: In(orderIds) });
            await dataSource.getRepository(Order).delete(orderIds);
          }
          await dataSource.getRepository(User).delete(user.id);
        }
      }
      if (productId) {
        await dataSource.getRepository(Product).delete(productId);
      }
    } finally {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    }
  }, 60_000);

  it('checks the API health endpoint', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          database: 'connected',
        });
      });
  });

  it('loads the menu, registers and logs in, places an order, and confirms payment', async () => {
    productId = randomUUID();
    await dataSource.getRepository(Product).insert({
      id: productId,
      name: 'E2E Menu Product',
      basePrice: 35000,
      stock: 3,
      imageUrl: null,
    });

    const menu = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    expect(menu.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productId })]),
    );

    customerEmail = `e2e-${randomUUID()}@brewlite.test`;
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'BrewLite E2E Customer',
        email: customerEmail,
        password: 'integration-password-1',
      })
      .expect(201);
    expect((registration.body as AuthResponse).user.email).toBe(customerEmail);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: customerEmail, password: 'integration-password-1' })
      .expect(200);
    const accessToken = (login.body as AuthResponse).accessToken;
    expect(accessToken).toBeTruthy();

    const order = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        items: [{ productId, quantity: 1, sizeCode: 'M', toppingIds: [] }],
      })
      .expect(201);
    expect(order.body.status).toBe('PENDING');

    const payment = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ orderId: order.body.id, method: 'WALLET' })
      .expect(200);
    expect(payment.body).toMatchObject({
      status: 'SUCCESS',
      orderStatus: 'PAID',
    });

    const confirmation = await request(app.getHttpServer())
      .get(`/orders/${order.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(confirmation.body.status).toBe('PAID');
    expect(confirmation.body.reservations[0].status).toBe('CONSUMED');
    expect(
      await dataSource.getRepository(Product).findOneByOrFail({ id: productId }),
    ).toMatchObject({ stock: 2 });
  });
});
