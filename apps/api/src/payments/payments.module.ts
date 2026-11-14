import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { MockPaymentGateway, MOCK_PAYMENT_CONFIGURATION } from './mock-payment.gateway';
import { PaymentAttempt } from './payment-attempt.entity';
import { PaymentGateway } from './payment-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    OrdersModule,
    InventoryModule,
    TypeOrmModule.forFeature([PaymentAttempt]),
  ],
  controllers: [PaymentsController],
  providers: [
    {
      provide: MOCK_PAYMENT_CONFIGURATION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        result: config.getOrThrow<'success' | 'failure'>('MOCK_PAYMENT_RESULT'),
        timeout: config.getOrThrow<boolean>('MOCK_PAYMENT_TIMEOUT'),
      }),
    },
    MockPaymentGateway,
    { provide: PaymentGateway, useExisting: MockPaymentGateway },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
