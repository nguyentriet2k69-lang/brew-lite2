import { PaymentMethod } from './payment-attempt.entity';

export type GatewayPaymentStatus = 'SUCCESS' | 'FAILED' | 'PROCESSING' | 'UNKNOWN';

export interface GatewayChargeRequest {
  orderId: string;
  paymentAttemptId: string;
  amount: number;
  currency: 'VND';
  method: PaymentMethod;
  gatewayIdempotencyKey: string;
}

export interface GatewayPaymentResult {
  status: GatewayPaymentStatus;
  gatewayReference: string | null;
  failureCode: string | null;
  failureMessage: string | null;
}

export abstract class PaymentGateway {
  abstract charge(request: GatewayChargeRequest): Promise<GatewayPaymentResult>;
  abstract lookupByIdempotencyKey(gatewayIdempotencyKey: string): Promise<GatewayPaymentResult>;
}
