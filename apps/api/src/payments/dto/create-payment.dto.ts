import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  orderId: string;

  @ApiProperty({ enum: ['CARD', 'WALLET'], example: 'CARD' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  method: string;
}
