import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Cà phê sữa đá' })
  name?: string;

  @ApiPropertyOptional({ example: 35000 })
  basePrice?: number;

  @ApiPropertyOptional({ example: 100 })
  stock?: number;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3' })
  imageUrl?: string;
}