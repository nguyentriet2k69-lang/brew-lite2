import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find();
  }

  async create(product: Partial<Product>): Promise<Product> {
    const newProduct = this.productsRepository.create(product);
    return this.productsRepository.save(newProduct);
  }
    async remove(id: string): Promise<void> {
    await this.productsRepository.delete(id);
  }

    async update(id: string, product: Partial<Product>): Promise<Product | null> {
    await this.productsRepository.update(id, product);
    return this.productsRepository.findOneBy({ id });
  }
}