import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryReservation } from './inventory-reservation.entity';
import { InventoryReservationItem } from './inventory-reservation-item.entity';
import { InventoryService } from './inventory.service';
import { InventoryExpiryScheduler } from './inventory-expiry.scheduler';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryReservation, InventoryReservationItem, Order, OrderItem])],
  providers: [InventoryService, InventoryExpiryScheduler],
  exports: [InventoryService],
})
export class InventoryModule {}
