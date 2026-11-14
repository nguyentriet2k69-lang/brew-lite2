import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { InventoryReservation } from '../inventory/inventory-reservation.entity';
import { InventoryReservationItem } from '../inventory/inventory-reservation-item.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    PricingModule,
    TypeOrmModule.forFeature([Order, OrderItem, InventoryReservation, InventoryReservationItem]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
