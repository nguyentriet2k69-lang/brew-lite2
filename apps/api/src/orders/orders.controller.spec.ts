import {
  BadRequestException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController HTTP contract', () => {
  let app: INestApplication;
  let service: { create: jest.Mock; findMine: jest.Mock; findOwned: jest.Mock };

  beforeAll(async () => {
    service = { create: jest.fn(), findMine: jest.fn(), findOwned: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: service },
        { provide: JwtStrategy, useValue: { authenticate: jest.fn().mockResolvedValue({ userId: 'current-user', email: 'u@example.com' }) } },
        JwtAuthGuard,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    service.create.mockReset().mockImplementation(async (_userId: string, key: string | undefined) => {
      if (!key) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'required' });
      return orderWithInternalFields();
    });
    service.findMine.mockReset().mockResolvedValue({ items: [orderWithInternalFields()], page: 1, pageSize: 20, total: 1 });
    service.findOwned.mockReset().mockResolvedValue(orderWithInternalFields());
  });

  it('requires JWT and Idempotency-Key for POST /orders', async () => {
    const payload = { items: [{ productId: '00000000-0000-4000-8000-000000000001', quantity: 1, sizeCode: 'S', toppingIds: [] }] };
    await request(app.getHttpServer()).post('/orders').send(payload).expect(401);
    const missingKey = await request(app.getHttpServer()).post('/orders').set('Authorization', 'Bearer test').send(payload).expect(400);
    expect(missingKey.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(service.create).toHaveBeenCalledWith('current-user', undefined, payload);
  });

  it('validates item input and rejects client-supplied prices', async () => {
    const base = { productId: '00000000-0000-4000-8000-000000000001', quantity: 1, sizeCode: 'S', toppingIds: [] };
    await request(app.getHttpServer()).post('/orders').set('Authorization', 'Bearer test').set('Idempotency-Key', 'k').send({ items: [{ ...base, quantity: 0 }] }).expect(400);
    const response = await request(app.getHttpServer()).post('/orders').set('Authorization', 'Bearer test').set('Idempotency-Key', 'k').send({ items: [{ ...base, unitPrice: 1 }] }).expect(400);
    expect(response.body.code).toBe('HTTP_400');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('routes /orders/me before the UUID detail route and applies pagination', async () => {
    const response = await request(app.getHttpServer()).get('/orders/me?page=2&pageSize=10').set('Authorization', 'Bearer test').expect(200);
    expect(response.body).toMatchObject({ page: 1, pageSize: 20 });
    expect(service.findMine).toHaveBeenCalledWith('current-user', expect.objectContaining({ page: 2, pageSize: 10 }));
  });

  it('validates detail UUIDs and maps inaccessible Orders to ORDER_NOT_FOUND', async () => {
    await request(app.getHttpServer()).get('/orders/not-a-uuid').set('Authorization', 'Bearer test').expect(400);
    service.findOwned.mockRejectedValue(new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' }));
    const response = await request(app.getHttpServer()).get('/orders/00000000-0000-4000-8000-000000000001').set('Authorization', 'Bearer test').expect(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('serializes Orders without idempotency internals or persistence-only relation fields', async () => {
    const auth = { Authorization: 'Bearer test' };
    const orderId = '00000000-0000-4000-8000-000000000002';
    const payload = { items: [{ productId: '00000000-0000-4000-8000-000000000001', quantity: 1, sizeCode: 'S', toppingIds: [] }] };
    const responses = await Promise.all([
      request(app.getHttpServer()).post('/orders').set(auth).set('Idempotency-Key', 'own-key').send(payload).expect(201),
      request(app.getHttpServer()).get(`/orders/${orderId}`).set(auth).expect(200),
      request(app.getHttpServer()).get('/orders/me').set(auth).expect(200),
    ]);
    for (const response of responses) {
      const order = response.body.id ? response.body : response.body.items[0];
      expect(order).not.toHaveProperty('idempotencyKey');
      expect(order).not.toHaveProperty('requestFingerprint');
      expect(order.items[0]).not.toHaveProperty('orderId');
      expect(order.reservations[0]).not.toHaveProperty('orderId');
      expect(order.reservations[0]).not.toHaveProperty('items');
    }
  });
});

function orderWithInternalFields() {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    userId: 'current-user',
    idempotencyKey: 'internal-key',
    requestFingerprint: 'internal-fingerprint',
    status: 'PENDING',
    totalAmount: 40000,
    items: [{
      id: '00000000-0000-4000-8000-000000000003',
      orderId: '00000000-0000-4000-8000-000000000002',
      productId: '00000000-0000-4000-8000-000000000001',
      productName: 'Cà phê Muối',
      basePrice: 40000,
      sizeSnapshot: { code: 'S', name: 'Nhỏ', priceAdjustment: 0 },
      toppingsSnapshot: [],
      quantity: 1,
      unitPrice: 40000,
      lineTotal: 40000,
    }],
    reservations: [{
      id: '00000000-0000-4000-8000-000000000004',
      orderId: '00000000-0000-4000-8000-000000000002',
      status: 'HELD',
      expiresAt: new Date('2026-11-14T00:15:00Z'),
      items: [{ id: 'private-reservation-item' }],
    }],
    createdAt: new Date('2026-11-14T00:00:00Z'),
    updatedAt: new Date('2026-11-14T00:00:00Z'),
  };
}
