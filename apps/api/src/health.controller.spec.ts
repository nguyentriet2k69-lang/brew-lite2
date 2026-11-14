import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports healthy when the database query succeeds', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const dataSource = {
      isInitialized: true,
      query,
    } as unknown as DataSource;
    const controller = new HealthController(dataSource);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
      timestamp: expect.any(String),
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns a service unavailable exception when the database query fails', async () => {
    const dataSource = {
      isInitialized: true,
      query: jest.fn().mockRejectedValue(new Error('private database detail')),
    } as unknown as DataSource;
    const controller = new HealthController(dataSource);

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(controller.check()).rejects.toMatchObject({
      response: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable.',
      },
    });
  });
});
