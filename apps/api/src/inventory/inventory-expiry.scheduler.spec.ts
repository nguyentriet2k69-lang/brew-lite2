import { InventoryService } from './inventory.service';
import { InventoryExpiryScheduler } from './inventory-expiry.scheduler';

describe('InventoryExpiryScheduler', () => {
  it('passes an explicit time to the expiry service and returns its count', async () => {
    const now = new Date('2030-01-01T00:00:00Z');
    const expireHeldReservations = jest.fn().mockResolvedValue(3);
    const inventory = { expireHeldReservations } as unknown as InventoryService;
    const scheduler = new InventoryExpiryScheduler(inventory);
    await expect(scheduler.runOnce(now)).resolves.toBe(3);
    expect(expireHeldReservations).toHaveBeenCalledWith(now);
  });
});
