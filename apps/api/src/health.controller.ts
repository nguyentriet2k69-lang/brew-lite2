import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  private databaseInitialization?: Promise<void>;

  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      if (!this.dataSource.isInitialized) {
        this.databaseInitialization ??= this.dataSource
          .initialize()
          .then(() => undefined)
          .finally(() => {
            this.databaseInitialization = undefined;
          });
        await this.databaseInitialization;
      }
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable.',
      });
    }

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
