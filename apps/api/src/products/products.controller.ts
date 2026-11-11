import { Controller, Get, Post, Body, Delete, Patch, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './product.entity';
import { ApiTags } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Post()
  create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    return this.productsService.create(createProductDto);
  }

  // Thêm API Xóa
  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.productsService.remove(id);
  }

  // Thêm API Cập nhật
  @Patch(':id')
   // Thêm API Cập nhật
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto): Promise<Product | null> {
    return this.productsService.update(id, updateProductDto);
  }
}