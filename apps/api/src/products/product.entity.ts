import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @Column()
  @ApiProperty()
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty()
  basePrice: number;

  @Column('int')
  @ApiProperty()
  stock: number;

  @Column({ nullable: true })
  @ApiProperty()
  imageUrl: string;
}