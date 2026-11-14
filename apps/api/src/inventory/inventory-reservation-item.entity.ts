import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../products/product.entity';
import { OrderItem } from '../orders/order-item.entity';
import { InventoryReservation } from './inventory-reservation.entity';

@Entity({ name: 'inventory_reservation_items' })
@Check('inventory_reservation_items_quantity_positive', '"quantity" > 0')
export class InventoryReservationItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reservationId: string;

  @ManyToOne(() => InventoryReservation, (reservation) => reservation.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservationId' })
  reservation: InventoryReservation;

  @Column({ type: 'uuid' })
  orderItemId: string;

  @ManyToOne(() => OrderItem, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'integer' })
  quantity: number;
}
