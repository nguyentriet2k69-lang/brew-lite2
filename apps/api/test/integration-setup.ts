const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for PostgreSQL integration tests. Start docker-compose.test.yml and set TEST_DATABASE_URL to its database.',
  );
}

process.env.NODE_ENV ??= 'test';

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
