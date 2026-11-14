import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';
import { HealthController } from './health.controller';
import { validateEnvironment, getEnvFilePaths } from './config/environment';
import { getNestPostgresOptions } from './config/database';
import { CreateProductBaseline1760000000000 } from './database/migrations/1760000000000-create-product-baseline';
import { CreateUsersTable1761000000000 } from './database/migrations/1761000000000-create-users-table';
import { AuthModule } from './auth/auth.module';
import { PricingModule } from './pricing/pricing.module';
import { CreateOrdersInventory1762000000000 } from './database/migrations/1762000000000-create-orders-inventory';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CreatePaymentAttempts1763000000000 } from './database/migrations/1763000000000-create-payment-attempts';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...getNestPostgresOptions(process.env),
        autoLoadEntities: true,
        migrations: [
          CreateProductBaseline1760000000000,
          CreateUsersTable1761000000000,
          CreateOrdersInventory1762000000000,
          CreatePaymentAttempts1763000000000,
        ],
        retryAttempts: 1,
        retryDelay: 1000,
      }),
    }),
    ProductsModule,
    AuthModule,
    PricingModule,
    OrdersModule,
    InventoryModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
