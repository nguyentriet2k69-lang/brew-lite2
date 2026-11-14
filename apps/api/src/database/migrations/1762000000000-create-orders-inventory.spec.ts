import { QueryRunner, Table } from 'typeorm';
import { CreateOrdersInventory1762000000000 } from './1762000000000-create-orders-inventory';

describe('CreateOrdersInventory migration', () => {
  it('creates the snapshot, reservation, index, and stock-protection schema', async () => {
    const tables: Table[] = [];
    const statements: string[] = [];
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(false),
      query: jest.fn(async (sql: string) => {
        statements.push(sql);
        return [];
      }),
      createTable: jest.fn(async (table: Table) => tables.push(table)),
    } as unknown as QueryRunner;
    await new CreateOrdersInventory1762000000000().up(queryRunner);

    expect(tables.map(({ name }) => name)).toEqual([
      'orders', 'order_items', 'inventory_reservations', 'inventory_reservation_items',
    ]);
    expect(tables[0].uniques?.[0].columnNames).toEqual(['userId', 'idempotencyKey']);
    expect(tables[0].foreignKeys[0].referencedTableName).toBe('users');
    expect(tables[1].findColumnByName('sizeSnapshot')?.type).toBe('jsonb');
    expect(tables[1].findColumnByName('toppingsSnapshot')?.type).toBe('jsonb');
    expect(tables[3].checks?.[0].expression).toBe('"quantity" > 0');
    expect(statements.some((sql) => sql.includes('product_stock_nonnegative'))).toBe(true);
  });

  it('refuses to roll back while orders exist', async () => {
    const dropTable = jest.fn();
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([{ has_orders: true }]),
      dropTable,
    } as unknown as QueryRunner;
    await expect(new CreateOrdersInventory1762000000000().down(queryRunner))
      .rejects.toThrow('Refusing to roll back Orders/Inventory migration while Orders exist.');
    expect(dropTable).not.toHaveBeenCalled();
  });
});
