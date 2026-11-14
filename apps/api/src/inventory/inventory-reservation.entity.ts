import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { InventoryReservationItem } from './inventory-reservation-item.entity';

export enum ReservationStatus {
  HELD = 'HELD',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  CONSUMED = 'CONSUMED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

@Entity({ name: 'inventory_reservations' })
@Index('inventory_reservations_expiry_idx', ['status', 'expiresAt'])
@Index('inventory_reservations_order_idx', ['orderId', 'createdAt'])
export class InventoryReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.reservations, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'enum', enum: ReservationStatus, enumName: 'inventory_reservations_status_enum' })
  status: ReservationStatus;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @OneToMany(() => InventoryReservationItem, (item) => item.reservation, { cascade: ['insert'] })
  items: InventoryReservationItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
