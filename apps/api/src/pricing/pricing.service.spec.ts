import { BadRequestException } from '@nestjs/common';
import { PRICING_CONFIGURATION } from './pricing.config';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  it('exposes three sizes and five toppings with unique identifiers', () => {
    const options = service.getPricingOptions();
    expect(options.currency).toBe('VND');
    expect(options.sizes).toHaveLength(3);
    expect(options.toppings).toHaveLength(5);
    expect(new Set(options.sizes.map(({ code }) => code)).size).toBe(3);
    expect(new Set(options.toppings.map(({ id }) => id)).size).toBe(5);
    expect(options.sizes.map(({ priceAdjustment }) => priceAdjustment)).toEqual([
      0, 5000, 10000,
    ]);
    expect(options.toppings.map(({ priceAdjustment }) => priceAdjustment)).toEqual([
      8000, 6000, 8000, 5000, 5000,
    ]);
  });

  it('returns defensive copies of its configuration', () => {
    const options = service.getPricingOptions();
    (options.sizes as { code: string; name: string; priceAdjustment: number }[])[0].name = 'Changed';
    expect(service.getPricingOptions().sizes[0].name).toBe('Nhỏ');
    expect(PRICING_CONFIGURATION.sizes[0].name).toBe('Nhỏ');
  });

  it.each([
    [35000, 'S', [], 35000],
    [35000, 'M', [], 40000],
    [35000, 'L', [], 45000],
    [35000, 'M', ['pearls'], 46000],
    [35000, 'L', ['extra-shot', 'vanilla'], 58000],
  ] as const)('calculates %i + %s + %j = %i', (base, size, toppings, expected) => {
    expect(service.calculateUnitPrice(base, size, toppings)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid base price %s',
    (price) => {
      expectCode(() => service.calculateUnitPrice(price, 'S'), 'INVALID_PRICE');
    },
  );

  it('rejects invalid size and topping selections', () => {
    expectCode(() => service.calculateUnitPrice(10000, 'XL'), 'INVALID_SIZE');
    expectCode(
      () => service.calculateUnitPrice(10000, 'S', ['unknown']),
      'INVALID_TOPPING',
    );
    expectCode(
      () => service.calculateUnitPrice(10000, 'S', ['pearls', 'pearls']),
      'DUPLICATE_TOPPING',
    );
    expectCode(
      () => service.calculateUnitPrice(10000, 'S', null as unknown as string[]),
      'INVALID_TOPPING',
    );
  });

  it('rejects arithmetic outside the safe integer range', () => {
    expectCode(
      () => service.calculateUnitPrice(Number.MAX_SAFE_INTEGER, 'M'),
      'PRICE_OVERFLOW',
    );
  });
});

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error(`Expected ${code} to be thrown`);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({ code });
  }
}
