import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity: number;

  @ApiProperty({ enum: ['S', 'M', 'L'] })
  @IsString()
  sizeCode: string;

  @ApiProperty({ type: [String], example: ['pearls', 'extra-shot'] })
  @IsArray()
  @IsString({ each: true })
  toppingIds: string[];
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto], minItems: 1 })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class OrderListQueryDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
