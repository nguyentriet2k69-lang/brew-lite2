import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsersTable1761000000000 implements MigrationInterface {
  name = 'CreateUsersTable1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      throw new Error(
        'The users table already exists without this migration being recorded. No schema or data changes were made.',
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            default: 'gen_random_uuid()',
          },
          { name: 'email', type: 'character varying', length: '254', isNullable: false },
          { name: 'passwordHash', type: 'character varying', length: '60', isNullable: false },
          { name: 'fullName', type: 'character varying', length: '120', isNullable: false },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.query(
      'CREATE UNIQUE INDEX "users_email_normalized_uq" ON "users" (LOWER("email"))',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) {
      return;
    }

    const rows = (await queryRunner.query(
      'SELECT EXISTS (SELECT 1 FROM "users" LIMIT 1) AS "has_users"',
    )) as Array<{ has_users: boolean }>;
    if (rows[0]?.has_users) {
      throw new Error(
        'Refusing to roll back the User migration while user records exist. Export or explicitly migrate those records before rollback.',
      );
    }

    await queryRunner.dropIndex('users', 'users_email_normalized_uq');
    await queryRunner.dropTable('users');
  }
}
