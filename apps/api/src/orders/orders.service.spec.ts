import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PricingService } from '../pricing/pricing.service';
import { Product } from '../products/product.entity';
import { InventoryReservation } from '../inventory/inventory-reservation.entity';
import { InventoryReservationItem } from '../inventory/inventory-reservation-item.entity';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';
import { OrdersService } from './orders.service';

const PRODUCT_ID = '00000000-0000-4000-8000-000000000011';
const USER_ID = '00000000-0000-4000-8000-000000000012';

describe('OrdersService', () => {
  it('prices with backend configuration, snapshots options, and aggregates identical lines for stock', async () => {
    const product = { id: PRODUCT_ID, name: 'Latte', basePrice: 35000, stock: 10 } as Product;
    const secondProduct = { id: '00000000-0000-4000-8000-000000000014', name: 'Tea', basePrice: 20000, stock: 3 } as Product;
    const context = makeContext([product, secondProduct]);
    const result = await context.service.create(USER_ID, 'key-1', { items: [
      { productId: PRODUCT_ID, quantity: 2, sizeCode: 'M', toppingIds: ['pearls', 'extra-shot'] },
      { productId: PRODUCT_ID, quantity: 3, sizeCode: 'M', toppingIds: ['extra-shot', 'pearls'] },
      { productId: secondProduct.id, quantity: 1, sizeCode: 'S', toppingIds: [] },
    ] });

    expect(result.totalAmount).toBe(5 * (35000 + 5000 + 6000 + 8000) + 20000);
    expect(result.status).toBe(OrderStatus.PENDING);
    expect(result.items).toHaveLength(2);
    const latte = result.items.find((item) => item.productId === PRODUCT_ID)!;
    expect(latte).toMatchObject({ quantity: 5, unitPrice: 54000, lineTotal: 270000 });
    expect(latte.productName).toBe('Latte');
    expect(latte.sizeSnapshot).toMatchObject({ code: 'M', name: 'Vừa', priceAdjustment: 5000 });
    expect(latte.toppingsSnapshot).toHaveLength(2);
    expect(product.stock).toBe(5);
    expect(secondProduct.stock).toBe(2);
    expect(result.reservations[0].status).toBe('HELD');
    expect(result.reservations[0].expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    product.name = 'Changed later';
    product.basePrice = 99999;
    expect(latte).toMatchObject({ productName: 'Latte', basePrice: 35000 });
  });

  it('does not accept client price fields and requires an idempotency key', async () => {
    const context = makeContext([]);
    await expect(context.service.create(USER_ID, undefined, { items: [] }))
      .rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    expect(context.transaction).not.toHaveBeenCalled();
  });

  it('rejects a missing product and rolls back without changing stock', async () => {
    const context = makeContext([]);
    await expect(context.service.create(USER_ID, 'missing', validPayload()))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(context.products).toHaveLength(0);
  });

  it('rejects insufficient stock atomically across products', async () => {
    const otherId = '00000000-0000-4000-8000-000000000013';
    const first = { id: PRODUCT_ID, name: 'A', basePrice: 10000, stock: 4 } as Product;
    const second = { id: otherId, name: 'B', basePrice: 10000, stock: 1 } as Product;
    const context = makeContext([first, second]);
    await expect(context.service.create(USER_ID, 'short', { items: [
      { productId: PRODUCT_ID, quantity: 2, sizeCode: 'S', toppingIds: [] },
      { productId: otherId, quantity: 2, sizeCode: 'S', toppingIds: [] },
    ] })).rejects.toMatchObject({ response: { code: 'OUT_OF_STOCK' } });
    expect(first.stock).toBe(4);
    expect(second.stock).toBe(1);
    expect(context.orderSave).not.toHaveBeenCalled();
  });

  it('returns the original order for the same normalized payload and rejects key reuse with a new payload', async () => {
    const old = { id: 'old-order', requestFingerprint: '', items: [], reservations: [] } as Order;
    const context = makeContext([], old);
    old.requestFingerprint = await fingerprintOf(validPayload());
    await expect(context.service.create(USER_ID, 'stable', validPayload())).resolves.toBe(old);
    await expect(context.service.create(USER_ID, 'stable', {
      items: [{ productId: PRODUCT_ID, quantity: 3, sizeCode: 'S', toppingIds: [] }],
    })).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(context.transaction).not.toHaveBeenCalled();
  });

  it('reports invalid Pricing configuration and price overflow', async () => {
    const decimal = { id: PRODUCT_ID, name: 'Bad data', basePrice: 100.5, stock: 1 } as Product;
    const context = makeContext([decimal]);
    await expect(context.service.create(USER_ID, 'decimal', validPayload()))
      .rejects.toMatchObject({ response: { code: 'INVALID_PRICE' } });
    const huge = { id: PRODUCT_ID, name: 'Huge', basePrice: Number.MAX_SAFE_INTEGER, stock: 1 } as Product;
    const overflow = makeContext([huge]);
    await expect(overflow.service.create(USER_ID, 'overflow', validPayload()))
      .rejects.toMatchObject({ response: { code: 'PRICE_OVERFLOW' } });
  });

  it('rejects invalid size, unknown topping, duplicate topping, and excessive grouped quantity', async () => {
    const product = { id: PRODUCT_ID, name: 'Coffee', basePrice: 10000, stock: 10 } as Product;
    for (const [key, sizeCode, toppingIds, expectedCode] of [
      ['size', 'XL', [], 'INVALID_SIZE'],
      ['topping', 'S', ['not-configured'], 'INVALID_TOPPING'],
      ['duplicate', 'S', ['pearls', 'pearls'], 'DUPLICATE_TOPPING'],
    ] as const) {
      const context = makeContext([product]);
      await expect(context.service.create(USER_ID, key, {
        items: [{ productId: PRODUCT_ID, quantity: 1, sizeCode, toppingIds: [...toppingIds] }],
      })).rejects.toMatchObject({ response: { code: expectedCode } });
    }
    const grouped = makeContext([product]);
    await expect(grouped.service.create(USER_ID, 'too-many', { items: [
      { productId: PRODUCT_ID, quantity: 2147483647, sizeCode: 'S', toppingIds: [] },
      { productId: PRODUCT_ID, quantity: 1, sizeCode: 'S', toppingIds: [] },
    ] })).rejects.toMatchObject({ response: { code: 'INVALID_ORDER_ITEMS' } });
  });
});

function validPayload() {
  return { items: [{ productId: PRODUCT_ID, quantity: 2, sizeCode: 'S', toppingIds: [] }] };
}

async function fingerprintOf(input: ReturnType<typeof validPayload>): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(JSON.stringify(input.items.map((item) => ({
    productId: item.productId,
    sizeCode: item.sizeCode,
    toppingIds: [...item.toppingIds].sort((a, b) => a.localeCompare(b)),
    quantity: item.quantity,
  })))).digest('hex');
}

function makeContext(products: Product[], existing?: Order) {
  let storedOrder: Partial<Order> = {};
  const orderSave = jest.fn(async (value: Partial<Order>) => {
    storedOrder = { ...value, id: 'new-order' };
    return storedOrder as Order;
  });
  let storedItems: OrderItem[] = [];
  let storedReservation: InventoryReservation | undefined;
  const productRepo = {
    createQueryBuilder: () => {
      const qb = {
        where: () => qb,
        orderBy: () => qb,
        setLock: () => qb,
        getMany: async () => products,
      };
      return qb;
    },
    save: jest.fn(async (values: Product[]) => values),
  };
  const orderRepo = {
    findOne: jest.fn(async () => null),
    create: (value: Partial<Order>) => value,
    save: orderSave,
    findOneOrFail: async () => ({
      id: 'new-order', status: OrderStatus.PENDING, totalAmount: storedOrder.totalAmount,
      items: storedItems, reservations: [storedReservation],
    } as unknown as Order),
  };
  const itemRepo = {
    create: (value: Partial<OrderItem>) => value,
    save: jest.fn(async (values: Partial<OrderItem>[]) => {
      storedItems = values.map((value, index) => ({ ...value, id: `item-${index}` } as OrderItem));
      return storedItems;
    }),
  };
  const reservationRepo = {
    create: (value: Partial<InventoryReservation>) => value,
    save: jest.fn(async (value: Partial<InventoryReservation>) => {
      storedReservation = { ...value, id: 'reservation', expiresAt: value.expiresAt } as InventoryReservation;
      return storedReservation;
    }),
  };
  const reservationItemRepo = {
    create: (value: Partial<InventoryReservationItem>) => value,
    save: jest.fn(async (values: Partial<InventoryReservationItem>[]) => values),
  };
  const repositoryByEntity = new Map<unknown, unknown>([
    [Product, productRepo], [Order, orderRepo], [OrderItem, itemRepo],
    [InventoryReservation, reservationRepo], [InventoryReservationItem, reservationItemRepo],
  ]);
  const manager = {
    getRepository: (entity: unknown) => repositoryByEntity.get(entity),
    query: jest.fn().mockResolvedValue(undefined),
  };
  const transaction = jest.fn(async (_isolation: string, callback: (manager: EntityManager) => Promise<unknown>) => callback(manager as unknown as EntityManager));
  const dataSource = {
    transaction,
    getRepository: () => ({ findOne: async () => existing ?? null }),
  };
  return {
    service: new OrdersService(dataSource as never, new PricingService()),
    transaction,
    products,
    orderSave,
  };
}
