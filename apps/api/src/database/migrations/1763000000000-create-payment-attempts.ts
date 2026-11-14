import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePaymentAttempts1763000000000 implements MigrationInterface {
  name = 'CreatePaymentAttempts1763000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('payment_attempts')) {
      throw new Error('The payment_attempts table already exists without this migration being recorded. No schema or data changes were made.');
    }
    await queryRunner.query('CREATE TYPE "payment_attempts_status_enum" AS ENUM (\'PROCESSING\', \'SUCCESS\', \'FAILED\', \'UNKNOWN\')');
    await queryRunner.query('CREATE TYPE "payment_attempts_method_enum" AS ENUM (\'CARD\', \'WALLET\')');
    await queryRunner.createTable(new Table({
      name: 'payment_attempts',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'orderId', type: 'uuid', isNullable: false },
        { name: 'reservationId', type: 'uuid', isNullable: false },
        { name: 'idempotencyKey', type: 'character varying', length: '128', isNullable: false },
        { name: 'requestFingerprint', type: 'character varying', length: '64', isNullable: false },
        { name: 'gatewayIdempotencyKey', type: 'character varying', length: '64', isNullable: false },
        { name: 'method', type: 'payment_attempts_method_enum', isNullable: false },
        { name: 'status', type: 'payment_attempts_status_enum', isNullable: false },
        { name: 'amount', type: 'numeric', precision: 20, scale: 0, isNullable: false },
        { name: 'currency', type: 'character varying', length: '3', isNullable: false, default: '\'VND\'' },
        { name: 'gatewayReference', type: 'character varying', length: '128', isNullable: true },
        { name: 'failureCode', type: 'character varying', length: '64', isNullable: true },
        { name: 'failureMessage', type: 'character varying', length: '255', isNullable: true },
        { name: 'completedAt', type: 'timestamp with time zone', isNullable: true },
        { name: 'createdAt', type: 'timestamp with time zone', isNullable: false, default: 'now()' },
        { name: 'updatedAt', type: 'timestamp with time zone', isNullable: false, default: 'now()' },
      ],
      uniques: [
        { name: 'payment_attempts_order_key_uq', columnNames: ['orderId', 'idempotencyKey'] },
        { name: 'payment_attempts_gateway_key_uq', columnNames: ['gatewayIdempotencyKey'] },
      ],
      foreignKeys: [
        { name: 'payment_attempts_order_fk', columnNames: ['orderId'], referencedTableName: 'orders', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'payment_attempts_reservation_fk', columnNames: ['reservationId'], referencedTableName: 'inventory_reservations', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      ],
    }));
    await queryRunner.query('CREATE INDEX "payment_attempts_order_created_idx" ON "payment_attempts" ("orderId", "createdAt" DESC)');
    await queryRunner.query('CREATE INDEX "payment_attempts_order_status_idx" ON "payment_attempts" ("orderId", "status")');
    await queryRunner.query('ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_amount_nonnegative" CHECK ("amount" >= 0)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment_attempts'))) return;
    const result = await queryRunner.query('SELECT EXISTS (SELECT 1 FROM "payment_attempts" LIMIT 1) AS "has_attempts"');
    if (result[0]?.has_attempts) {
      throw new Error('Refusing to roll back Payment Attempts migration while PaymentAttempt records exist. Export or explicitly migrate payment records before rollback.');
    }
    await queryRunner.dropTable('payment_attempts');
    await queryRunner.query('DROP TYPE IF EXISTS "payment_attempts_method_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "payment_attempts_status_enum"');
  }
}
