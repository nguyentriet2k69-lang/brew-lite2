import { BadRequestException, INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { PaymentAttemptStatus, PaymentMethod } from './payment-attempt.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController HTTP contract', () => {
  let app: INestApplication;
  let createOrReplay: jest.Mock;
  let findOwned: jest.Mock;

  beforeAll(async () => {
    createOrReplay = jest.fn();
    findOwned = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: { createOrReplay, findOwned } },
        { provide: JwtStrategy, useValue: { authenticate: jest.fn().mockResolvedValue({ userId: 'customer-1', email: 'u@example.com' }) } },
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
    findOwned.mockReset().mockResolvedValue({
      ...result(PaymentAttemptStatus.UNKNOWN),
      reservationStatus: 'PAYMENT_PENDING',
      updatedAt: new Date('2026-11-14T00:00:01Z'),
    });
    createOrReplay.mockReset().mockImplementation((_userId: string, key: string | undefined, input: { method: string }) => {
      if (!key || !key.trim()) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'required' });
      if (!['CARD', 'WALLET'].includes(input.method)) throw new BadRequestException({ code: 'INVALID_PAYMENT_METHOD', message: 'method must be CARD or WALLET.' });
      return result(PaymentAttemptStatus.SUCCESS);
    });
  });

  it('requires JWT and reads payment state by attempt id without invoking create/reconcile', async () => {
    const attemptId = '00000000-0000-4000-8000-000000000004';
    await request(app.getHttpServer()).get(`/payments/${attemptId}`).expect(401);
    const response = await request(app.getHttpServer())
      .get(`/payments/${attemptId}`)
      .set('Authorization', 'Bearer test')
      .expect(200);
    expect(response.body).toMatchObject({ status: 'UNKNOWN', orderStatus: 'PENDING', reservationStatus: 'PAYMENT_PENDING', amount: 92000, currency: 'VND' });
    expect(findOwned).toHaveBeenCalledWith('customer-1', attemptId);
    expect(createOrReplay).not.toHaveBeenCalled();
  });

  it('rejects non-UUID payment attempt ids', async () => {
    await request(app.getHttpServer()).get('/payments/not-a-uuid').set('Authorization', 'Bearer test').expect(400);
    expect(findOwned).not.toHaveBeenCalled();
  });

  it('requires JWT and Idempotency-Key and forwards the authenticated user', async () => {
    const body = { orderId: '00000000-0000-4000-8000-000000000001', method: 'card' };
    await request(app.getHttpServer()).post('/payments').send(body).expect(401);
    const missing = await request(app.getHttpServer()).post('/payments').set('Authorization', 'Bearer test').send(body).expect(400);
    expect(missing.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    const response = await request(app.getHttpServer()).post('/payments').set('Authorization', 'Bearer test').set('Idempotency-Key', 'key-1').send(body).expect(200);
    expect(response.body).toMatchObject({ paymentAttemptId: 'attempt-1', orderId: body.orderId, amount: 92000, currency: 'VND', status: 'SUCCESS' });
    expect(createOrReplay).toHaveBeenCalledWith('customer-1', 'key-1', expect.objectContaining({ method: 'CARD' }));
  });

  it('rejects malformed DTO fields and does not accept client-controlled amount', async () => {
    const token = { Authorization: 'Bearer test' };
    await request(app.getHttpServer()).post('/payments').set(token).set('Idempotency-Key', 'k').send({ orderId: 'bad', method: 'CARD' }).expect(400);
    await request(app.getHttpServer()).post('/payments').set(token).set('Idempotency-Key', 'k').send({ orderId: '00000000-0000-4000-8000-000000000001', method: 'CARD', amount: 1 }).expect(400);
    expect(createOrReplay).not.toHaveBeenCalled();
  });

  it('returns the INVALID_PAYMENT_METHOD error for unsupported methods', async () => {
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', 'Bearer test')
      .set('Idempotency-Key', 'bad-method')
      .send({ orderId: '00000000-0000-4000-8000-000000000001', method: 'PAYPAL' })
      .expect(400);
    expect(response.body.code).toBe('INVALID_PAYMENT_METHOD');
  });

  it('returns HTTP 202 for unresolved outcomes and keeps a stable response schema', async () => {
    createOrReplay.mockResolvedValue(result(PaymentAttemptStatus.UNKNOWN));
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', 'Bearer test')
      .set('Idempotency-Key', 'retry-original')
      .send({ orderId: '00000000-0000-4000-8000-000000000001', method: 'WALLET' })
      .expect(202);
    expect(response.body).toMatchObject({ status: 'UNKNOWN', orderStatus: 'PENDING', gatewayReference: null });
  });

  it('maps inaccessible Orders to 404 without exposing ownership', async () => {
    createOrReplay.mockRejectedValue(new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' }));
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', 'Bearer test')
      .set('Idempotency-Key', 'k')
      .send({ orderId: '00000000-0000-4000-8000-000000000001', method: 'CARD' })
      .expect(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });
});

function result(status: PaymentAttemptStatus) {
  return {
    paymentAttemptId: 'attempt-1',
    orderId: '00000000-0000-4000-8000-000000000001',
    reservationId: '00000000-0000-4000-8000-000000000002',
    status,
    method: PaymentMethod.CARD,
    amount: 92000,
    currency: 'VND' as const,
    gatewayReference: status === PaymentAttemptStatus.SUCCESS ? 'mock-reference' : null,
    failureCode: null,
    createdAt: new Date('2026-11-14T00:00:00Z'),
    completedAt: status === PaymentAttemptStatus.SUCCESS ? new Date('2026-11-14T00:00:01Z') : null,
    orderStatus: status === PaymentAttemptStatus.SUCCESS ? 'PAID' : 'PENDING',
  };
}
