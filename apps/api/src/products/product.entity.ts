import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ValueTransformer,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * PostgreSQL's NUMERIC driver value is a string. NUMERIC(10,2) stays safely
 * within JavaScript's precise range, so expose the existing numeric API shape.
 */
export const productPriceTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => {
    const serialized = String(value);
    if (!/^-?\d{1,8}(?:\.\d{1,2})?$/.test(serialized)) {
      throw new Error('Product.basePrice is outside the NUMERIC(10,2) range.');
    }

    const amount = Number(serialized);
    if (!Number.isFinite(amount)) {
      throw new Error('Product.basePrice is not a finite number.');
    }
    return amount;
  },
};

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @Column()
  @ApiProperty()
  name: string;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: productPriceTransformer,
  })
  @ApiProperty({ type: Number, example: 35000 })
  basePrice: number;

  @Column('int')
  @ApiProperty()
  stock: number;

  @Column({ nullable: true })
  @ApiProperty({ type: String, nullable: true })
  imageUrl: string | null;
}
