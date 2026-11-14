import { randomBytes } from 'node:crypto';

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for PostgreSQL end-to-end tests.',
  );
}

try {
  const parsedUrl = new URL(databaseUrl);
  if (
    !['postgres:', 'postgresql:'].includes(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    parsedUrl.pathname.length < 2
  ) {
    throw new Error();
  }
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET ??= randomBytes(32).toString('hex');
process.env.CORS_ORIGIN ??= 'http://localhost:3000';
process.env.DB_LOGGING ??= 'false';
process.env.MOCK_PAYMENT_RESULT ??= 'success';
process.env.MOCK_PAYMENT_TIMEOUT ??= 'false';
