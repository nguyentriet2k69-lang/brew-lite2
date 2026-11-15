import AppDataSource from './data-source';

async function runMigrations(): Promise<void> {
  try {
    await AppDataSource.initialize();
    const migrations = await AppDataSource.runMigrations();
    if (migrations.length === 0) {
      console.log('[migration] no pending migrations.');
      return;
    }

    for (const migration of migrations) {
      console.log(`[migration] applied: ${migration.name}`);
    }
  } catch (error) {
    console.error('[migration] failed:', error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void runMigrations();
