import {
  MigrationInterface,
  QueryRunner,
  Table,
} from 'typeorm';

export class CreateProductBaseline1760000000000
  implements MigrationInterface
{
  name = 'CreateProductBaseline1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('product');

    if (table) {
      this.assertCompatibleExistingProductTable(table);
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'product',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'character varying', isNullable: false },
          {
            name: 'basePrice',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          { name: 'stock', type: 'integer', isNullable: false },
          {
            name: 'imageUrl',
            type: 'character varying',
            isNullable: true,
          },
        ],
      }),
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'The Product baseline migration is intentionally irreversible to protect existing Product data.',
    );
  }

  private assertCompatibleExistingProductTable(table: Table): void {
    const expectedColumns = [
      { name: 'id', type: 'uuid', nullable: false, primary: true },
      { name: 'name', type: 'character varying', nullable: false, primary: false },
      { name: 'basePrice', type: 'numeric', nullable: false, primary: false },
      { name: 'stock', type: 'integer', nullable: false, primary: false },
      { name: 'imageUrl', type: 'character varying', nullable: true, primary: false },
    ];

    for (const expected of expectedColumns) {
      const actual = table.findColumnByName(expected.name);
      if (
        !actual ||
        actual.type !== expected.type ||
        actual.isNullable !== expected.nullable ||
        actual.isPrimary !== expected.primary
      ) {
        throw new Error(
          `Existing Product table is incompatible with the baseline migration at column "${expected.name}". No schema changes were made.`,
        );
      }

      if (
        expected.name === 'basePrice' &&
        (actual.precision !== 10 || actual.scale !== 2)
      ) {
        throw new Error(
          'Existing Product.basePrice must be NUMERIC(10,2) for the baseline migration. No schema changes were made.',
        );
      }
    }
  }
}
