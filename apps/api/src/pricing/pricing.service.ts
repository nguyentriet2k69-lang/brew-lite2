import { BadRequestException, Injectable } from '@nestjs/common';
import { PRICING_CONFIGURATION } from './pricing.config';
import {
  PricingOptions,
  SizeOption,
  ToppingOption,
} from './interfaces/pricing.interface';

@Injectable()
export class PricingService {
  getPricingOptions(): PricingOptions {
    return {
      currency: PRICING_CONFIGURATION.currency,
      sizes: PRICING_CONFIGURATION.sizes.map((size) => ({ ...size })),
      toppings: PRICING_CONFIGURATION.toppings.map((topping) => ({
        ...topping,
      })),
    };
  }

  calculateUnitPrice(
    basePrice: number,
    sizeCode: string,
    toppingIds: readonly string[] = [],
  ): number {
    this.validateBasePrice(basePrice);
    const size = this.findSize(sizeCode);
    const toppings = this.findToppings(toppingIds);

    let unitPrice = basePrice;
    unitPrice = this.addPrice(unitPrice, size.priceAdjustment);
    for (const topping of toppings) {
      unitPrice = this.addPrice(unitPrice, topping.priceAdjustment);
    }
    return unitPrice;
  }

  private validateBasePrice(basePrice: number): void {
    if (
      typeof basePrice !== 'number' ||
      !Number.isSafeInteger(basePrice) ||
      basePrice < 0
    ) {
      throw new BadRequestException({
        code: 'INVALID_PRICE',
        message: 'basePrice must be a non-negative safe integer in VND.',
      });
    }
  }

  private findSize(sizeCode: string): SizeOption {
    const size = PRICING_CONFIGURATION.sizes.find(
      (option) => option.code === sizeCode,
    );
    if (!size) {
      throw new BadRequestException({
        code: 'INVALID_SIZE',
        message: 'The requested size is not available.',
      });
    }
    return size as SizeOption;
  }

  private findToppings(toppingIds: readonly string[]): ToppingOption[] {
    if (!Array.isArray(toppingIds)) {
      throw new BadRequestException({
        code: 'INVALID_TOPPING',
        message: 'toppingIds must be an array of configured topping IDs.',
      });
    }

    const uniqueIds = new Set(toppingIds);
    if (uniqueIds.size !== toppingIds.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_TOPPING',
        message: 'A topping cannot be selected more than once.',
      });
    }

    return toppingIds.map((id) => {
      const topping = PRICING_CONFIGURATION.toppings.find(
        (option) => option.id === id,
      );
      if (!topping) {
        throw new BadRequestException({
          code: 'INVALID_TOPPING',
          message: `The topping "${id}" is not available.`,
        });
      }
      return topping;
    });
  }

  private addPrice(current: number, adjustment: number): number {
    const total = current + adjustment;
    if (!Number.isSafeInteger(total)) {
      throw new BadRequestException({
        code: 'PRICE_OVERFLOW',
        message: 'The calculated unit price exceeds the safe integer range.',
      });
    }
    return total;
  }
}
