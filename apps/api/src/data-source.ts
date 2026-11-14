import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { getEnvFilePaths } from './config/environment';
import { getPostgresOptions } from './config/database';
import { Product } from './products/product.entity';
import { User } from './users/user.entity';
import { CreateProductBaseline1760000000000 } from './database/migrations/1760000000000-create-product-baseline';
import { CreateUsersTable1761000000000 } from './database/migrations/1761000000000-create-users-table';
import { CreateOrdersInventory1762000000000 } from './database/migrations/1762000000000-create-orders-inventory';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { InventoryReservation } from './inventory/inventory-reservation.entity';
import { InventoryReservationItem } from './inventory/inventory-reservation-item.entity';
import { PaymentAttempt } from './payments/payment-attempt.entity';
import { CreatePaymentAttempts1763000000000 } from './database/migrations/1763000000000-create-payment-attempts';

for (const envFilePath of getEnvFilePaths()) {
  if (existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath);
  }
}

const AppDataSource = new DataSource({
  ...getPostgresOptions(process.env),
  entities: [Product, User, Order, OrderItem, InventoryReservation, InventoryReservationItem, PaymentAttempt],
  migrations: [
    CreateProductBaseline1760000000000,
    CreateUsersTable1761000000000,
    CreateOrdersInventory1762000000000,
    CreatePaymentAttempts1763000000000,
  ],
});

export default AppDataSource;
