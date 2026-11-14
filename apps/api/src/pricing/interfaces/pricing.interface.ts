export type SizeCode = 'S' | 'M' | 'L';

export interface SizeOption {
  code: SizeCode;
  name: string;
  priceAdjustment: number;
}

export interface ToppingOption {
  id: string;
  name: string;
  priceAdjustment: number;
}

export interface PricingOptions {
  currency: 'VND';
  sizes: readonly SizeOption[];
  toppings: readonly ToppingOption[];
}
