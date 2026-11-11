import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Cà phê sữa đá', description: 'Tên sản phẩm' })
  name: string;

  @ApiProperty({ example: 35000, description: 'Giá cơ bản' })
  basePrice: number;

  @ApiProperty({ example: 100, description: 'Số lượng trong kho' })
  stock: number;

  @ApiProperty({ 
    example: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d', 
    description: 'Link ảnh sản phẩm',
    required: false 
  })
  imageUrl?: string;
}