import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Product } from './product.entity';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let find: jest.Mock;
  let findOneBy: jest.Mock;

  beforeEach(async () => {
    find = jest.fn();
    findOneBy = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: { find, findOneBy },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('returns products from the Product repository', async () => {
    const products = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Cà phê sữa đá',
        basePrice: 35000,
        stock: 10,
        imageUrl: null,
      },
    ] as Product[];
    find.mockResolvedValue(products);

    await expect(service.findAll()).resolves.toBe(products);
    expect(find).toHaveBeenCalledWith();
  });

  it('queries one product by UUID', async () => {
    const product = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Cà phê sữa đá',
      basePrice: 35000,
      stock: 10,
      imageUrl: null,
    } as Product;
    findOneBy.mockResolvedValue(product);

    await expect(service.findById(product.id)).resolves.toBe(product);
    expect(findOneBy).toHaveBeenCalledWith({ id: product.id });
  });

  it('throws a consistent 404 when the repository has no matching product', async () => {
    findOneBy.mockResolvedValue(null);

    await expect(
      service.findById('00000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
