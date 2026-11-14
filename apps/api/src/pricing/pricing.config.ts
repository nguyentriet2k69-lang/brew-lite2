import { PricingOptions } from './interfaces/pricing.interface';

/** Demo adjustments in integer VND; these are not official store prices. */
export const PRICING_CONFIGURATION = {
  currency: 'VND',
  sizes: [
    { code: 'S', name: 'Nhỏ', priceAdjustment: 0 },
    { code: 'M', name: 'Vừa', priceAdjustment: 5000 },
    { code: 'L', name: 'Lớn', priceAdjustment: 10000 },
  ],
  toppings: [
    { id: 'extra-shot', name: 'Thêm shot espresso', priceAdjustment: 8000 },
    { id: 'pearls', name: 'Trân châu', priceAdjustment: 6000 },
    { id: 'cream-cheese', name: 'Kem cheese', priceAdjustment: 8000 },
    { id: 'chocolate', name: 'Sốt chocolate', priceAdjustment: 5000 },
    { id: 'vanilla', name: 'Vanilla', priceAdjustment: 5000 },
  ],
} as const satisfies PricingOptions;
