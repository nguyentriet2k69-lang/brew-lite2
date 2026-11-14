import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus } from '../orders/order.entity';
import { ReservationStatus } from '../inventory/inventory-reservation.entity';
import { PaymentAttempt, PaymentAttemptStatus, PaymentMethod } from './payment-attempt.entity';
import { PaymentGateway } from './payment-gateway';
import { PaymentsService } from './payments.service';

describe('PaymentsService polling', () => {
  const attempt = {
    id: '00000000-0000-4000-8000-000000000001',
    orderId: '00000000-0000-4000-8000-000000000002',
    reservationId: '00000000-0000-4000-8000-000000000003',
    status: PaymentAttemptStatus.UNKNOWN,
    method: PaymentMethod.CARD,
    amount: 92000,
    currency: 'VND',
    gatewayReference: null,
    failureCode: null,
    createdAt: new Date('2026-11-14T00:00:00Z'),
    completedAt: null,
    updatedAt: new Date('2026-11-14T00:00:01Z'),
    order: { userId: 'owner-1', status: OrderStatus.PENDING },
    reservation: { status: ReservationStatus.PAYMENT_PENDING },
  } as PaymentAttempt;
  const findOne = jest.fn();
  const gateway = { charge: jest.fn(), lookupByIdempotencyKey: jest.fn() };
  const service = new PaymentsService(
    { getRepository: () => ({ findOne }) } as unknown as DataSource,
    {} as InventoryService,
    gateway as unknown as PaymentGateway,
  );

  beforeEach(() => findOne.mockReset().mockResolvedValue(attempt));

  it('returns persisted payment, order, reservation, amount and timestamps without contacting gateway', async () => {
    await expect(service.findOwned('owner-1', attempt.id)).resolves.toMatchObject({
      paymentAttemptId: attempt.id,
      orderId: attempt.orderId,
      reservationId: attempt.reservationId,
      status: PaymentAttemptStatus.UNKNOWN,
      orderStatus: OrderStatus.PENDING,
      reservationStatus: ReservationStatus.PAYMENT_PENDING,
      amount: 92000,
      currency: 'VND',
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    });
    expect(findOne).toHaveBeenCalledWith({
      where: { id: attempt.id },
      relations: { order: true, reservation: true },
    });
    expect(gateway.charge).not.toHaveBeenCalled();
    expect(gateway.lookupByIdempotencyKey).not.toHaveBeenCalled();
  });

  it('returns the same not-found response for missing attempts and attempts owned by another user', async () => {
    await expect(service.findOwned('other-user', attempt.id)).rejects.toBeInstanceOf(NotFoundException);
    findOne.mockResolvedValueOnce(null);
    await expect(service.findOwned('owner-1', attempt.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
