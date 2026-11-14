import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateOrdersInventory1762000000000 implements MigrationInterface {
  name = 'CreateOrdersInventory1762000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['orders', 'order_items', 'inventory_reservations', 'inventory_reservation_items']) {
      if (await queryRunner.hasTable(tableName)) {
        throw new Error(`The ${tableName} table already exists without this migration being recorded. No schema or data changes were made.`);
      }
    }
    await queryRunner.query('CREATE TYPE "orders_status_enum" AS ENUM (\'PENDING\', \'PAID\', \'PAYMENT_FAILED\', \'CANCELLED\')');
    await queryRunner.query('CREATE TYPE "inventory_reservations_status_enum" AS ENUM (\'HELD\', \'PAYMENT_PENDING\', \'CONSUMED\', \'RELEASED\', \'EXPIRED\')');
    await queryRunner.createTable(new Table({
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'userId', type: 'uuid', isNullable: false },
        { name: 'idempotencyKey', type: 'character varying', length: '128', isNullable: false },
        { name: 'requestFingerprint', type: 'character varying', length: '64', isNullable: false },
        { name: 'status', type: 'orders_status_enum', isNullable: false, default: '\'PENDING\'' },
        { name: 'totalAmount', type: 'numeric', precision: 20, scale: 0, isNullable: false },
        { name: 'createdAt', type: 'timestamp with time zone', isNullable: false, default: 'now()' },
        { name: 'updatedAt', type: 'timestamp with time zone', isNullable: false, default: 'now()' },
      ],
      uniques: [{ name: 'orders_user_idempotency_uq', columnNames: ['userId', 'idempotencyKey'] }],
      checks: [{ name: 'orders_total_amount_nonnegative', expression: '"totalAmount" >= 0' }],
      foreignKeys: [{ name: 'orders_user_fk', columnNames: ['userId'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }],
    }));
    await queryRunner.query('CREATE INDEX "orders_user_created_idx" ON "orders" ("userId", "createdAt" DESC, "id" DESC)');

    await queryRunner.createTable(new Table({
      name: 'order_items',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'orderId', type: 'uuid', isNullable: false },
        { name: 'productId', type: 'uuid', isNullable: false },
        { name: 'productName', type: 'character varying', length: '255', isNullable: false },
        { name: 'basePrice', type: 'numeric', precision: 20, scale: 0, isNullable: false },
        { name: 'sizeSnapshot', type: 'jsonb', isNullable: false },
        { name: 'toppingsSnapshot', type: 'jsonb', isNullable: false, default: "'[]'::jsonb" },
        { name: 'quantity', type: 'integer', isNullable: false },
        { name: 'unitPrice', type: 'numeric', precision: 20, scale: 0, isNullable: false },
        { name: 'lineTotal', type: 'numeric', precision: 20, scale: 0, isNullable: false },
      ],
      checks: [
        { name: 'order_items_quantity_positive', expression: '"quantity" > 0' },
        { name: 'order_items_amounts_nonnegative', expression: '"basePrice" >= 0 AND "unitPrice" >= 0 AND "lineTotal" >= 0' },
      ],
      foreignKeys: [
        { name: 'order_items_order_fk', columnNames: ['orderId'], referencedTableName: 'orders', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
        { name: 'order_items_product_fk', columnNames: ['productId'], referencedTableName: 'product', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      ],
    }));
    await queryRunner.query('CREATE INDEX "order_items_order_idx" ON "order_items" ("orderId")');

    await queryRunner.createTable(new Table({
      name: 'inventory_reservations',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'orderId', type: 'uuid', isNullable: false },
        { name: 'status', type: 'inventory_reservations_status_enum', isNullable: false },
        { name: 'expiresAt', type: 'timestamp with time zone', isNullable: false },
        { name: 'createdAt', type: 'timestamp with time zone', isNullable: false, default: 'now()' },
        { name: 'updatedAt', type: 'timestamp with time zone', isNullable: false, default: 'now()' },
      ],
      foreignKeys: [{ name: 'inventory_reservations_order_fk', columnNames: ['orderId'], referencedTableName: 'orders', referencedColumnNames: ['id'], onDelete: 'CASCADE' }],
    }));
    await queryRunner.query('CREATE INDEX "inventory_reservations_expiry_idx" ON "inventory_reservations" ("status", "expiresAt")');
    await queryRunner.query('CREATE INDEX "inventory_reservations_order_idx" ON "inventory_reservations" ("orderId", "createdAt" DESC)');

    await queryRunner.createTable(new Table({
      name: 'inventory_reservation_items',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'reservationId', type: 'uuid', isNullable: false },
        { name: 'orderItemId', type: 'uuid', isNullable: false },
        { name: 'productId', type: 'uuid', isNullable: false },
        { name: 'quantity', type: 'integer', isNullable: false },
      ],
      checks: [{ name: 'inventory_reservation_items_quantity_positive', expression: '"quantity" > 0' }],
      foreignKeys: [
        { name: 'inventory_reservation_items_reservation_fk', columnNames: ['reservationId'], referencedTableName: 'inventory_reservations', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
        { name: 'inventory_reservation_items_order_item_fk', columnNames: ['orderItemId'], referencedTableName: 'order_items', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'inventory_reservation_items_product_fk', columnNames: ['productId'], referencedTableName: 'product', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      ],
    }));
    await queryRunner.query('CREATE INDEX "inventory_reservation_items_reservation_idx" ON "inventory_reservation_items" ("reservationId")');

    const stockConstraint = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = 'product_stock_nonnegative' AND conrelid = 'product'::regclass`);
    if (stockConstraint.length === 0) {
      await queryRunner.query('ALTER TABLE "product" ADD CONSTRAINT "product_stock_nonnegative" CHECK ("stock" >= 0)');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('orders'))) return;
    const result = await queryRunner.query('SELECT EXISTS (SELECT 1 FROM "orders" LIMIT 1) AS "has_orders"');
    if (result[0]?.has_orders) {
      throw new Error('Refusing to roll back Orders/Inventory migration while Orders exist. Export or explicitly migrate order data before rollback.');
    }
    await queryRunner.dropTable('inventory_reservation_items');
    await queryRunner.dropTable('inventory_reservations');
    await queryRunner.dropTable('order_items');
    await queryRunner.dropTable('orders');
    await queryRunner.query('ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_stock_nonnegative"');
    await queryRunner.query('DROP TYPE IF EXISTS "inventory_reservations_status_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "orders_status_enum"');
  }
}
