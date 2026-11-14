import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';
import { InventoryReservation } from '../inventory/inventory-reservation.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CANCELLED = 'CANCELLED',
}

export const safeIntegerAmountTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string | number) => {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error('Order amount is outside the safe integer VND range.');
    }
    return parsed;
  },
};

@Entity({ name: 'orders' })
@Check('orders_total_amount_nonnegative', '"totalAmount" >= 0')
@Index('orders_user_created_idx', ['userId', 'createdAt'])
@Index('orders_user_idempotency_uq', ['userId', 'idempotencyKey'], { unique: true })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 128 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 64 })
  requestFingerprint: string;

  @Column({ type: 'enum', enum: OrderStatus, enumName: 'orders_status_enum', default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'numeric', precision: 20, scale: 0, transformer: safeIntegerAmountTransformer })
  totalAmount: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: ['insert'] })
  items: OrderItem[];

  @OneToMany(() => InventoryReservation, (reservation) => reservation.order)
  reservations: InventoryReservation[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
