import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { PricingService } from '../pricing/pricing.service';
import { Product } from '../products/product.entity';
import { Order, OrderStatus } from './order.entity';
import { OrderItem, SizeSnapshot, ToppingSnapshot } from './order-item.entity';
import { CreateOrderDto, OrderListQueryDto } from './dto/create-order.dto';
import { InventoryReservation, ReservationStatus } from '../inventory/inventory-reservation.entity';
import { InventoryReservationItem } from '../inventory/inventory-reservation-item.entity';

const RESERVATION_TTL_MS = 15 * 60 * 1000;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

interface NormalizedItem {
  productId: string;
  quantity: number;
  sizeCode: string;
  toppingIds: string[];
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pricingService: PricingService,
  ) {}

  async create(userId: string, keyHeader: unknown, input: CreateOrderDto): Promise<Order> {
    const key = this.validateIdempotencyKey(keyHeader);
    const normalizedItems = this.normalizeItems(input);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(normalizedItems))
      .digest('hex');

    const prior = await this.findByKey(userId, key);
    if (prior) return this.resolvePrior(prior, fingerprint);

    try {
      return await this.dataSource.transaction('READ COMMITTED', async (manager) => {
        // Serialize concurrent attempts for the same user/key before stock checks.
        // The unique index remains the final correctness boundary for any writer
        // that does not use this service.
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [userId, key]);
        // Recheck inside the transaction before locking Products.
        const existing = await manager.getRepository(Order).findOne({
          where: { userId, idempotencyKey: key },
          relations: { items: true, reservations: true },
        });
        if (existing) return this.resolvePrior(existing, fingerprint);

        const productIds = [...new Set(normalizedItems.map((item) => item.productId))].sort();
        const products = await manager.getRepository(Product)
          .createQueryBuilder('product')
          .where('product.id IN (:...ids)', { ids: productIds })
          .orderBy('product.id', 'ASC')
          .setLock('pessimistic_write')
          .getMany();
        const productById = new Map(products.map((product) => [product.id, product]));
        for (const id of productIds) {
          if (!productById.has(id)) {
            throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'A requested product was not found.' });
          }
        }

        const requiredByProduct = new Map<string, number>();
        const snapshots: Array<Partial<OrderItem>> = [];
        let totalAmount = 0;
        for (const item of normalizedItems) {
          const product = productById.get(item.productId)!;
          if (!Number.isSafeInteger(product.basePrice) || product.basePrice < 0) {
            throw new ConflictException({ code: 'INVALID_PRICE', message: 'The product price is not an integer VND amount.' });
          }
          const unitPrice = this.pricingService.calculateUnitPrice(
            product.basePrice,
            item.sizeCode,
            item.toppingIds,
          );
          const lineTotal = unitPrice * item.quantity;
          if (!Number.isSafeInteger(lineTotal) || lineTotal < 0) {
            throw new ConflictException({ code: 'PRICE_OVERFLOW', message: 'The order line exceeds the safe integer VND range.' });
          }
          totalAmount += lineTotal;
          if (!Number.isSafeInteger(totalAmount)) {
            throw new ConflictException({ code: 'PRICE_OVERFLOW', message: 'The order total exceeds the safe integer VND range.' });
          }
          requiredByProduct.set(item.productId, (requiredByProduct.get(item.productId) ?? 0) + item.quantity);

          const options = this.pricingService.getPricingOptions();
          const size = options.sizes.find((candidate) => candidate.code === item.sizeCode)!;
          const toppings = item.toppingIds.map((id) => options.toppings.find((candidate) => candidate.id === id)!);
          snapshots.push({
            productId: product.id,
            productName: product.name,
            basePrice: product.basePrice,
            sizeSnapshot: { code: size.code, name: size.name, priceAdjustment: size.priceAdjustment } satisfies SizeSnapshot,
            toppingsSnapshot: toppings.map((topping) => ({ id: topping.id, name: topping.name, priceAdjustment: topping.priceAdjustment })) satisfies ToppingSnapshot[],
            quantity: item.quantity,
            unitPrice,
            lineTotal,
          });
        }

        for (const [id, quantity] of requiredByProduct) {
          const product = productById.get(id)!;
          if (!Number.isSafeInteger(quantity) || quantity > product.stock) {
            throw new ConflictException({ code: 'OUT_OF_STOCK', message: `Insufficient stock for product ${id}.` });
          }
        }

        for (const [id, quantity] of requiredByProduct) {
          const product = productById.get(id)!;
          product.stock -= quantity;
        }
        await manager.getRepository(Product).save(products);

        const order = await manager.getRepository(Order).save(manager.getRepository(Order).create({
          userId,
          idempotencyKey: key,
          requestFingerprint: fingerprint,
          status: OrderStatus.PENDING,
          totalAmount,
        }));
        const orderItems = await manager.getRepository(OrderItem).save(
          snapshots.map((snapshot) => manager.getRepository(OrderItem).create({ ...snapshot, orderId: order.id })),
        );
        const reservation = await manager.getRepository(InventoryReservation).save(
          manager.getRepository(InventoryReservation).create({
            orderId: order.id,
            status: ReservationStatus.HELD,
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          }),
        );
        await manager.getRepository(InventoryReservationItem).save(
          orderItems.map((item) => manager.getRepository(InventoryReservationItem).create({
            reservationId: reservation.id,
            orderItemId: item.id,
            productId: item.productId,
            quantity: item.quantity,
          })),
        );
        return this.loadOrder(manager, order.id);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raced = await this.findByKey(userId, key);
        if (raced) return this.resolvePrior(raced, fingerprint);
      }
      throw error;
    }
  }

  async findMine(userId: string, query: OrderListQueryDto) {
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const page = query.page ?? 1;
    const [items, total] = await this.dataSource.getRepository(Order).findAndCount({
      where: { userId },
      relations: { items: true, reservations: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, page, pageSize, total };
  }

  async findOwned(userId: string, orderId: string): Promise<Order> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId, userId },
      relations: { items: true, reservations: true },
      order: { reservations: { createdAt: 'DESC' } },
    });
    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' });
    }
    return order;
  }

  async loadOrder(manager: EntityManager, orderId: string): Promise<Order> {
    return manager.getRepository(Order).findOneOrFail({
      where: { id: orderId },
      relations: { items: true, reservations: true },
      order: { reservations: { createdAt: 'DESC' } },
    });
  }

  private async findByKey(userId: string, idempotencyKey: string): Promise<Order | null> {
    return this.dataSource.getRepository(Order).findOne({
      where: { userId, idempotencyKey },
      relations: { items: true, reservations: true },
    });
  }

  private resolvePrior(order: Order, fingerprint: string): Order {
    if (order.requestFingerprint !== fingerprint) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'This idempotency key was used with a different order payload.' });
    }
    return order;
  }

  private validateIdempotencyKey(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: `Idempotency-Key must contain 1-${IDEMPOTENCY_KEY_MAX_LENGTH} characters.` });
    }
    return value.trim();
  }

  private normalizeItems(input: CreateOrderDto): NormalizedItem[] {
    if (!input || !Array.isArray(input.items) || input.items.length === 0) {
      throw new ConflictException({ code: 'INVALID_ORDER_ITEMS', message: 'At least one order item is required.' });
    }
    const grouped = new Map<string, NormalizedItem>();
    for (const raw of input.items) {
      const toppingIds = [...raw.toppingIds].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      const item = { productId: raw.productId, sizeCode: raw.sizeCode, toppingIds, quantity: raw.quantity };
      const key = JSON.stringify([item.productId, item.sizeCode, item.toppingIds]);
      const existing = grouped.get(key);
      const quantity = (existing?.quantity ?? 0) + item.quantity;
      if (!Number.isSafeInteger(quantity) || quantity > 2147483647) {
        throw new ConflictException({ code: 'INVALID_ORDER_ITEMS', message: 'Combined quantity exceeds the supported range.' });
      }
      grouped.set(key, { ...item, quantity });
    }
    return [...grouped.values()].sort((a, b) =>
      JSON.stringify([a.productId, a.sizeCode, a.toppingIds]) < JSON.stringify([b.productId, b.sizeCode, b.toppingIds]) ? -1 :
        JSON.stringify([a.productId, a.sizeCode, a.toppingIds]) > JSON.stringify([b.productId, b.sizeCode, b.toppingIds]) ? 1 : 0,
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError &&
      typeof error.driverError === 'object' && error.driverError !== null &&
      'code' in error.driverError && error.driverError.code === '23505';
  }
}
