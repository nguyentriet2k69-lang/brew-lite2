import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InventoryService } from './inventory.service';

@Injectable()
export class InventoryExpiryScheduler {
  constructor(private readonly inventoryService: InventoryService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'brewLiteExpireHeldInventoryReservations',
    waitForCompletion: true,
  })
  handleExpiryTick(): Promise<number> {
    return this.runOnce();
  }

  async runOnce(now = new Date()): Promise<number> {
    return this.inventoryService.expireHeldReservations(now);
  }
}
