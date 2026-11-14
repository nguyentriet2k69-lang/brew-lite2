import AppDataSource from './data-source';
import { seedDemoProducts } from './products/demo-products.seed';

async function runSeed(): Promise<void> {
  try {
    await AppDataSource.initialize();
    const result = await AppDataSource.transaction(async (manager) => {
      // Serialize this script against concurrent runs without adding schema.
      await manager.query('SELECT pg_advisory_xact_lock(13568, 2)');
      return seedDemoProducts(manager);
    });

    for (const name of result.inserted) {
      console.log(`[seed] inserted: ${name}`);
    }
    for (const name of result.alreadyPresent) {
      console.log(`[seed] already present, unchanged: ${name}`);
    }
    for (const conflict of result.conflicts) {
      console.warn(
        `[seed] skipped name conflict: "${conflict.name}" already belongs to id ${conflict.existingId}`,
      );
    }
    console.log(
      `[seed] summary: ${result.inserted.length} inserted, ${result.alreadyPresent.length} unchanged, ${result.conflicts.length} conflict(s) skipped.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    console.error(`[seed] failed: ${message}`);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void runSeed();
