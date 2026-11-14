import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { safeIntegerAmountTransformer } from '../orders/order.entity';
import { Order } from '../orders/order.entity';
import { InventoryReservation } from '../inventory/inventory-reservation.entity';

export enum PaymentAttemptStatus {
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
}

export enum PaymentMethod {
  CARD = 'CARD',
  WALLET = 'WALLET',
}

@Entity({ name: 'payment_attempts' })
@Index('payment_attempts_order_key_uq', ['orderId', 'idempotencyKey'], { unique: true })
@Index('payment_attempts_order_created_idx', ['orderId', 'createdAt'])
@Index('payment_attempts_order_status_idx', ['orderId', 'status'])
@Index('payment_attempts_gateway_key_uq', ['gatewayIdempotencyKey'], { unique: true })
export class PaymentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  reservationId: string;

  @ManyToOne(() => InventoryReservation, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reservationId' })
  reservation: InventoryReservation;

  @Column({ type: 'varchar', length: 128 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 64 })
  requestFingerprint: string;

  @Column({ type: 'varchar', length: 64 })
  gatewayIdempotencyKey: string;

  @Column({ type: 'enum', enum: PaymentMethod, enumName: 'payment_attempts_method_enum' })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentAttemptStatus, enumName: 'payment_attempts_status_enum' })
  status: PaymentAttemptStatus;

  @Column({ type: 'numeric', precision: 20, scale: 0, transformer: safeIntegerAmountTransformer })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: 'VND';

  @Column({ type: 'varchar', length: 128, nullable: true })
  gatewayReference: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  failureCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
