import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { MockPaymentResult } from '../config/environment';
import {
  GatewayChargeRequest,
  GatewayPaymentResult,
  PaymentGateway,
} from './payment-gateway';

export interface MockPaymentConfiguration {
  result: MockPaymentResult;
  timeout: boolean;
}

export const MOCK_PAYMENT_CONFIGURATION = Symbol('MOCK_PAYMENT_CONFIGURATION');

@Injectable()
export class MockPaymentGateway extends PaymentGateway {
  constructor(
    @Inject(MOCK_PAYMENT_CONFIGURATION)
    private readonly configuration: MockPaymentConfiguration,
  ) {
    super();
  }

  async charge(request: GatewayChargeRequest): Promise<GatewayPaymentResult> {
    if (this.configuration.timeout) return this.unknownResult();
    return this.resolve(request.gatewayIdempotencyKey);
  }

  async lookupByIdempotencyKey(gatewayIdempotencyKey: string): Promise<GatewayPaymentResult> {
    if (this.configuration.timeout) return this.unknownResult();
    return this.resolve(gatewayIdempotencyKey);
  }

  private resolve(gatewayIdempotencyKey: string): GatewayPaymentResult {
    const reference = `mock-${createHash('sha256').update(gatewayIdempotencyKey).digest('hex').slice(0, 32)}`;
    if (this.configuration.result === 'success') {
      return { status: 'SUCCESS', gatewayReference: reference, failureCode: null, failureMessage: null };
    }
    return {
      status: 'FAILED',
      gatewayReference: reference,
      failureCode: 'MOCK_DECLINED',
      failureMessage: 'Mock payment was declined.',
    };
  }

  private unknownResult(): GatewayPaymentResult {
    return { status: 'UNKNOWN', gatewayReference: null, failureCode: null, failureMessage: null };
  }
}
