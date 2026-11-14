import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController HTTP routes', () => {
  let app: INestApplication;
  let findAll: jest.Mock;
  let findById: jest.Mock;

  const product = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Cà phê sữa đá',
    basePrice: 35000,
    stock: 10,
    imageUrl: null,
  };

  beforeAll(async () => {
    findAll = jest.fn();
    findById = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: { findAll, findById },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findAll.mockReset().mockResolvedValue([product]);
    findById.mockReset().mockResolvedValue(product);
  });

  it('GET /products returns the public Product fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/products')
      .expect(200);

    expect(response.body).toEqual([product]);
    expect(Object.keys(response.body[0]).sort()).toEqual(
      ['basePrice', 'id', 'imageUrl', 'name', 'stock'].sort(),
    );
    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it('GET /products/:id returns one product', async () => {
    const response = await request(app.getHttpServer())
      .get(`/products/${product.id}`)
      .expect(200);

    expect(response.body).toEqual(product);
    expect(findById).toHaveBeenCalledWith(product.id);
  });

  it('returns 404 when the product does not exist', async () => {
    findById.mockRejectedValue(
      new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product was not found.',
      }),
    );

    const response = await request(app.getHttpServer())
      .get(`/products/${product.id}`)
      .expect(404);

    expect(response.body).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('returns 400 for an invalid UUID without calling the service', async () => {
    await request(app.getHttpServer()).get('/products/not-a-uuid').expect(400);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each(['post', 'patch', 'delete'] as const)(
    'does not expose public %s /products write routes',
    async (method) => {
      const testRequest = request(app.getHttpServer());
      const response =
        method === 'post'
          ? testRequest.post('/products')
          : method === 'patch'
            ? testRequest.patch('/products')
            : testRequest.delete('/products');
      await response.expect(404);
    },
  );
});
