import type { DataSourceOptions } from 'typeorm';
import { validateEnvironment } from './environment';

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

export function getPostgresOptions(
  env: Record<string, unknown>,
): Pick<
  PostgresOptions,
  | 'type'
  | 'url'
  | 'logging'
  | 'synchronize'
  | 'migrationsRun'
  | 'uuidExtension'
  | 'installExtensions'
  | 'connectTimeoutMS'
> {
  const config = validateEnvironment(env);

  return {
    type: 'postgres',
    url: config.DATABASE_URL,
    logging: config.DB_LOGGING,
    synchronize: false,
    migrationsRun: false,
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    connectTimeoutMS: 5000,
  };
}

/** Nest should establish the database connection during application startup. */
export function getNestPostgresOptions(env: Record<string, unknown>) {
  return {
    ...getPostgresOptions(env),
    manualInitialization: false,
  };
}
