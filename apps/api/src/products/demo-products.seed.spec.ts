import { EntityManager } from 'typeorm';
import { Product } from './product.entity';
import { DEMO_PRODUCTS, seedDemoProducts } from './demo-products.seed';

function makeManager() {
  const rows = new Map<string, Product>();
  const findOneBy = jest.fn(async (_entity: typeof Product, where: { id: string }) =>
    rows.get(where.id) ?? null,
  );
  const query = jest.fn(async (_sql: string, [name]: [string]) => {
    const existing = [...rows.values()].find(
      (row) => row.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return existing ? [{ id: existing.id, name: existing.name }] : [];
  });
  const insert = jest.fn(async (_entity: typeof Product, value: Product) => {
    rows.set(value.id, value);
    return undefined;
  });

  return {
    rows,
    findOneBy,
    query,
    insert,
    manager: { findOneBy, query, insert } as unknown as EntityManager,
  };
}

describe('demo Product seed', () => {
  it('defines exactly nine complete products with stable unique UUIDs and images', () => {
    expect(DEMO_PRODUCTS).toHaveLength(9);
    expect(new Set(DEMO_PRODUCTS.map(({ id }) => id)).size).toBe(9);
    for (const product of DEMO_PRODUCTS) {
      expect(product.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(product.imageUrl).toMatch(/^https:\/\//);
      expect(Object.keys(product).sort()).toEqual(
        ['basePrice', 'id', 'imageUrl', 'name', 'stock'].sort(),
      );
    }
  });

  it('inserts missing products once and skips all rows on a second run', async () => {
    const fake = makeManager();

    const firstRun = await seedDemoProducts(fake.manager);
    const secondRun = await seedDemoProducts(fake.manager);

    expect(firstRun.inserted).toHaveLength(9);
    expect(fake.insert).toHaveBeenCalledTimes(9);
    expect(secondRun.inserted).toHaveLength(0);
    expect(secondRun.alreadyPresent).toHaveLength(9);
    expect(fake.insert).toHaveBeenCalledTimes(9);
  });

  it('skips a same-name product with another ID without overwriting it', async () => {
    const fake = makeManager();
    const firstSeed = DEMO_PRODUCTS[0];
    fake.rows.set('11111111-1111-4111-8111-111111111111', {
      ...firstSeed,
      id: '11111111-1111-4111-8111-111111111111',
      name: `  ${firstSeed.name.toUpperCase()}  `,
      basePrice: 12345,
      stock: 7,
    } as Product);

    const result = await seedDemoProducts(fake.manager);

    expect(result.conflicts).toContainEqual({
      name: firstSeed.name,
      existingId: '11111111-1111-4111-8111-111111111111',
    });
    expect(fake.insert).toHaveBeenCalledTimes(8);
    expect(fake.rows.get('11111111-1111-4111-8111-111111111111')).toMatchObject({
      basePrice: 12345,
      stock: 7,
    });
  });
});
