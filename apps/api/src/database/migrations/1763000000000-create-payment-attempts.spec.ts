import { QueryRunner, Table } from 'typeorm';
import { CreatePaymentAttempts1763000000000 } from './1763000000000-create-payment-attempts';

describe('CreatePaymentAttempts migration', () => {
  it('creates the attempt states, method, idempotency constraints, and foreign keys', async () => {
    const table = jest.fn(async (_value: Table) => undefined);
    const statements: string[] = [];
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(false),
      createTable: table,
      query: jest.fn(async (sql: string) => {
        statements.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;
    await new CreatePaymentAttempts1763000000000().up(queryRunner);
    const definition = table.mock.calls[0][0];
    expect(definition.name).toBe('payment_attempts');
    expect(definition.uniques?.map(({ name }) => name)).toEqual([
      'payment_attempts_order_key_uq', 'payment_attempts_gateway_key_uq',
    ]);
    expect(definition.foreignKeys?.map(({ referencedTableName }) => referencedTableName)).toEqual([
      'orders', 'inventory_reservations',
    ]);
    expect(definition.findColumnByName('amount')?.type).toBe('numeric');
    expect(statements.some((sql) => sql.includes('UNKNOWN'))).toBe(true);
    expect(statements.some((sql) => sql.includes('CARD') && sql.includes('WALLET'))).toBe(true);
  });

  it('refuses to drop payment data during rollback', async () => {
    const dropTable = jest.fn();
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([{ has_attempts: true }]),
      dropTable,
    } as unknown as QueryRunner;
    await expect(new CreatePaymentAttempts1763000000000().down(queryRunner))
      .rejects.toThrow('Refusing to roll back Payment Attempts migration while PaymentAttempt records exist.');
    expect(dropTable).not.toHaveBeenCalled();
  });
});
