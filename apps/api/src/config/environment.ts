import { resolve } from 'node:path';

export type NodeEnvironment = 'development' | 'test' | 'production';
export type MockPaymentResult = 'success' | 'failure';

export interface AppEnvironment {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: `${number}${'s' | 'm' | 'h' | 'd'}`;
  CORS_ORIGIN: string[];
  DB_LOGGING: boolean;
  MOCK_PAYMENT_RESULT: MockPaymentResult;
  MOCK_PAYMENT_TIMEOUT: boolean;
}

export class EnvironmentConfigurationError extends Error {
  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n${issues.join('\n')}`);
    this.name = 'EnvironmentConfigurationError';
  }
}

export function getEnvFilePaths(): string[] {
  return [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
}

function readString(
  input: Record<string, unknown>,
  key: string,
  defaultValue: string,
  issues: string[],
): string {
  const value = input[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== 'string') {
    issues.push(`${key} must be a string.`);
    return '';
  }
  return value;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): AppEnvironment {
  const issues: string[] = [];
  const nodeEnv = readString(input, 'NODE_ENV', 'development', issues);
  const allowedEnvironments: NodeEnvironment[] = [
    'development',
    'test',
    'production',
  ];

  if (!allowedEnvironments.includes(nodeEnv as NodeEnvironment)) {
    issues.push('NODE_ENV must be development, test, or production.');
  }

  const portValue = readString(input, 'PORT', '3001', issues);
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || port < 1 || port > 65535) {
    issues.push('PORT must be an integer between 1 and 65535.');
  }

  const databaseUrl = readString(input, 'DATABASE_URL', '', issues).trim();
  if (!databaseUrl) {
    issues.push('DATABASE_URL is required.');
  } else {
    try {
      const parsed = new URL(databaseUrl);
      if (
        !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.pathname.length < 2
      ) {
        issues.push(
          'DATABASE_URL must be a valid PostgreSQL URL with a host and database name.',
        );
      }
    } catch {
      issues.push(
        'DATABASE_URL must be a valid PostgreSQL URL with a host and database name.',
      );
    }
  }

  const jwtSecret = readString(input, 'JWT_SECRET', '', issues);
  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    issues.push('JWT_SECRET must contain at least 32 UTF-8 bytes.');
  }

  const jwtExpiresIn = readString(input, 'JWT_EXPIRES_IN', '1d', issues);
  if (!/^[1-9]\d*(s|m|h|d)$/i.test(jwtExpiresIn)) {
    issues.push('JWT_EXPIRES_IN must be a positive duration in seconds, minutes, hours, or days.');
  }

  const corsValue = readString(
    input,
    'CORS_ORIGIN',
    nodeEnv === 'production' ? '' : 'http://localhost:3000',
    issues,
  ).trim();
  const corsOrigins = corsValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    issues.push('CORS_ORIGIN is required (except in non-production defaults).');
  }

  for (const origin of corsOrigins) {
    if (origin === '*') {
      issues.push('CORS_ORIGIN must not contain a wildcard.');
      continue;
    }

    try {
      const parsed = new URL(origin);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin.replace(/\/$/, '')
      ) {
        issues.push('Each CORS_ORIGIN must be an HTTP(S) origin without a path.');
      }
    } catch {
      issues.push('Each CORS_ORIGIN must be a valid HTTP(S) origin.');
    }
  }

  const loggingValue = readString(input, 'DB_LOGGING', 'false', issues).toLowerCase();
  if (loggingValue !== 'true' && loggingValue !== 'false') {
    issues.push('DB_LOGGING must be either true or false.');
  } else if (nodeEnv === 'production' && loggingValue === 'true') {
    issues.push('DB_LOGGING must be false in production to avoid logging SQL parameters and personal data.');
  }

  const mockPaymentResult = readString(input, 'MOCK_PAYMENT_RESULT', 'success', issues)
    .trim()
    .toLowerCase();
  if (mockPaymentResult !== 'success' && mockPaymentResult !== 'failure') {
    issues.push('MOCK_PAYMENT_RESULT must be success or failure.');
  }
  const mockPaymentTimeout = readString(input, 'MOCK_PAYMENT_TIMEOUT', 'false', issues)
    .trim()
    .toLowerCase();
  if (mockPaymentTimeout !== 'true' && mockPaymentTimeout !== 'false') {
    issues.push('MOCK_PAYMENT_TIMEOUT must be either true or false.');
  }

  if (issues.length > 0) {
    throw new EnvironmentConfigurationError(issues);
  }

  return {
    NODE_ENV: nodeEnv as NodeEnvironment,
    PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn as AppEnvironment['JWT_EXPIRES_IN'],
    CORS_ORIGIN: corsOrigins,
    DB_LOGGING: loggingValue === 'true',
    MOCK_PAYMENT_RESULT: mockPaymentResult as MockPaymentResult,
    MOCK_PAYMENT_TIMEOUT: mockPaymentTimeout === 'true',
  };
}
