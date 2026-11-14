import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './product.entity';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List public products' })
  @ApiOkResponse({ type: Product, isArray: true })
  findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public product by UUID' })
  @ApiParam({ name: 'id', format: 'uuid', example: '00000000-0000-4000-8000-000000000001' })
  @ApiOkResponse({ type: Product })
  @ApiBadRequestResponse({ description: 'The product id must be a UUID.' })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Product> {
    return this.productsService.findById(id);
  }
}
