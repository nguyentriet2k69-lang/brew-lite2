import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  ValueTransformer,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { Order } from './order.entity';

const amountTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string | number) => {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error('Order item amount is outside the safe integer VND range.');
    }
    return parsed;
  },
};

export interface SizeSnapshot {
  code: string;
  name: string;
  priceAdjustment: number;
}

export interface ToppingSnapshot {
  id: string;
  name: string;
  priceAdjustment: number;
}

@Entity({ name: 'order_items' })
@Check('order_items_quantity_positive', '"quantity" > 0')
@Check('order_items_amounts_nonnegative', '"basePrice" >= 0 AND "unitPrice" >= 0 AND "lineTotal" >= 0')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'numeric', precision: 20, scale: 0, transformer: amountTransformer })
  basePrice: number;

  @Column({ type: 'jsonb' })
  sizeSnapshot: SizeSnapshot;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  toppingsSnapshot: ToppingSnapshot[];

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 20, scale: 0, transformer: amountTransformer })
  unitPrice: number;

  @Column({ type: 'numeric', precision: 20, scale: 0, transformer: amountTransformer })
  lineTotal: number;
}
