import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

describe('PricingController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [PricingService],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns public pricing options with stable VND integer amounts', async () => {
    const response = await request(app.getHttpServer())
      .get('/pricing/options')
      .expect(200);
    expect(response.body.currency).toBe('VND');
    expect(response.body.sizes).toHaveLength(3);
    expect(response.body.toppings).toHaveLength(5);
    for (const option of [...response.body.sizes, ...response.body.toppings]) {
      expect(Number.isSafeInteger(option.priceAdjustment)).toBe(true);
    }
  });

  it.each(['post', 'patch', 'delete'] as const)(
    'does not expose %s pricing mutations',
    async (method) => {
      await request(app.getHttpServer())[method]('/pricing/options').expect(404);
    },
  );
});
