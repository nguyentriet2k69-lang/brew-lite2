import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import type { PricingOptions, SizeCode } from './interfaces/pricing.interface';
import { PricingService } from './pricing.service';

class SizeOptionResponseDto {
  @ApiProperty({ enum: ['S', 'M', 'L'], example: 'M' })
  code: SizeCode;

  @ApiProperty({ example: 'Vừa' })
  name: string;

  @ApiProperty({ type: Number, example: 5000, minimum: 0 })
  priceAdjustment: number;
}

class ToppingOptionResponseDto {
  @ApiProperty({ example: 'extra-shot' })
  id: string;

  @ApiProperty({ example: 'Thêm shot espresso' })
  name: string;

  @ApiProperty({ type: Number, example: 8000, minimum: 0 })
  priceAdjustment: number;
}

class PricingOptionsResponseDto {
  @ApiProperty({ enum: ['VND'], example: 'VND' })
  currency: 'VND';

  @ApiProperty({ type: [SizeOptionResponseDto] })
  sizes: SizeOptionResponseDto[];

  @ApiProperty({ type: [ToppingOptionResponseDto] })
  toppings: ToppingOptionResponseDto[];
}

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('options')
  @ApiOperation({ summary: 'Get configured size and topping price adjustments' })
  @ApiOkResponse({ type: PricingOptionsResponseDto })
  getOptions(): PricingOptions {
    return this.pricingService.getPricingOptions();
  }
}
