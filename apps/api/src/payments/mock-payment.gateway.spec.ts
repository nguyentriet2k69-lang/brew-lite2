import { MockPaymentGateway } from './mock-payment.gateway';
import { PaymentMethod } from './payment-attempt.entity';
import { GatewayChargeRequest } from './payment-gateway';

const charge: GatewayChargeRequest = {
  orderId: 'order-1',
  paymentAttemptId: 'attempt-1',
  amount: 92000,
  currency: 'VND',
  method: PaymentMethod.CARD,
  gatewayIdempotencyKey: 'stable-key',
};

describe('MockPaymentGateway', () => {
  it('returns a deterministic success reference for charge and lookup across instances', async () => {
    const first = new MockPaymentGateway({ result: 'success', timeout: false });
    const restarted = new MockPaymentGateway({ result: 'success', timeout: false });
    const result = await first.charge(charge);
    await expect(restarted.lookupByIdempotencyKey(charge.gatewayIdempotencyKey)).resolves.toEqual(result);
    expect(result.status).toBe('SUCCESS');
    expect(result.gatewayReference).toMatch(/^mock-[a-f0-9]{32}$/);
  });

  it('returns a sanitized stable failure without storing or receiving credentials', async () => {
    const gateway = new MockPaymentGateway({ result: 'failure', timeout: false });
    const result = await gateway.charge(charge);
    expect(result).toMatchObject({ status: 'FAILED', failureCode: 'MOCK_DECLINED', failureMessage: 'Mock payment was declined.' });
    await expect(gateway.lookupByIdempotencyKey(charge.gatewayIdempotencyKey)).resolves.toEqual(result);
  });

  it('simulates timeout as UNKNOWN and resolves by lookup after timeout is disabled', async () => {
    const timedOut = new MockPaymentGateway({ result: 'success', timeout: true });
    const recovered = new MockPaymentGateway({ result: 'success', timeout: false });
    await expect(timedOut.charge(charge)).resolves.toMatchObject({ status: 'UNKNOWN', gatewayReference: null });
    await expect(timedOut.lookupByIdempotencyKey(charge.gatewayIdempotencyKey)).resolves.toMatchObject({ status: 'UNKNOWN' });
    await expect(recovered.lookupByIdempotencyKey(charge.gatewayIdempotencyKey)).resolves.toMatchObject({ status: 'SUCCESS' });
  });
});
