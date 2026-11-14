import {
  EnvironmentConfigurationError,
  validateEnvironment,
} from './environment';
import { getNestPostgresOptions, getPostgresOptions } from './database';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://tester:secret@localhost:5432/brewlite',
  JWT_SECRET: 'test-only-jwt-secret-not-for-production-0123456789',
  CORS_ORIGIN: 'http://localhost:3000',
  DB_LOGGING: 'false',
};

describe('validateEnvironment', () => {
  it('parses the supported application environment', () => {
    expect(validateEnvironment(validEnvironment)).toEqual({
      NODE_ENV: 'test',
      PORT: 3001,
      DATABASE_URL: validEnvironment.DATABASE_URL,
      JWT_SECRET: validEnvironment.JWT_SECRET,
      JWT_EXPIRES_IN: '1d',
      CORS_ORIGIN: ['http://localhost:3000'],
      DB_LOGGING: false,
      MOCK_PAYMENT_RESULT: 'success',
      MOCK_PAYMENT_TIMEOUT: false,
    });
  });

  it('requires a valid PostgreSQL URL without echoing credentials', () => {
    expect(() => validateEnvironment({ ...validEnvironment, DATABASE_URL: '' }))
      .toThrow('DATABASE_URL is required.');
    expect(() =>
      validateEnvironment({ ...validEnvironment, DATABASE_URL: 'mysql://user:secret@db/app' }),
    ).toThrow('valid PostgreSQL URL');
  });

  it('requires a sufficiently long JWT secret and validates token expiry', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, JWT_SECRET: 'short' }),
    ).toThrow('JWT_SECRET must contain at least 32 UTF-8 bytes.');
    expect(() =>
      validateEnvironment({ ...validEnvironment, JWT_EXPIRES_IN: 'forever' }),
    ).toThrow('JWT_EXPIRES_IN must be a positive duration');
    expect(validateEnvironment(validEnvironment).JWT_EXPIRES_IN).toBe('1d');
  });

  it('rejects invalid ports, wildcard origins, and production without CORS origin', () => {
    expect(() => validateEnvironment({ ...validEnvironment, PORT: '70000' }))
      .toThrow('PORT must be an integer');
    expect(() => validateEnvironment({ ...validEnvironment, CORS_ORIGIN: '*' }))
      .toThrow('must not contain a wildcard');
    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'production', CORS_ORIGIN: '' }),
    ).toThrow(EnvironmentConfigurationError);
  });

  it('rejects non-boolean DB_LOGGING values', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, DB_LOGGING: 'sometimes' }),
    ).toThrow('DB_LOGGING must be either true or false.');
  });

  it('rejects SQL query logging in production', () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://brew.example.com',
      DB_LOGGING: 'true',
    })).toThrow('DB_LOGGING must be false in production');
  });

  it('validates mock payment outcome and timeout configuration', () => {
    expect(validateEnvironment({ ...validEnvironment, MOCK_PAYMENT_RESULT: 'FAILURE' }).MOCK_PAYMENT_RESULT)
      .toBe('failure');
    expect(validateEnvironment({ ...validEnvironment, MOCK_PAYMENT_TIMEOUT: 'true' }).MOCK_PAYMENT_TIMEOUT)
      .toBe(true);
    expect(() => validateEnvironment({ ...validEnvironment, MOCK_PAYMENT_RESULT: 'unknown' }))
      .toThrow('MOCK_PAYMENT_RESULT must be success or failure.');
    expect(() => validateEnvironment({ ...validEnvironment, MOCK_PAYMENT_TIMEOUT: 'yes' }))
      .toThrow('MOCK_PAYMENT_TIMEOUT must be either true or false.');
  });

  it('keeps TypeORM schema synchronization and automatic migrations disabled', () => {
    expect(getPostgresOptions(validEnvironment)).toMatchObject({
      type: 'postgres',
      url: validEnvironment.DATABASE_URL,
      synchronize: false,
      migrationsRun: false,
      logging: false,
      uuidExtension: 'pgcrypto',
      installExtensions: false,
    });
  });

  it('initializes the Nest TypeORM data source during application startup', () => {
    expect(getNestPostgresOptions(validEnvironment)).toMatchObject({
      synchronize: false,
      migrationsRun: false,
      manualInitialization: false,
    });
  });
});
