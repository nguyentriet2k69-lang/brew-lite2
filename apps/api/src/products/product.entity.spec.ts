import { productPriceTransformer } from './product.entity';

describe('Product price transformer', () => {
  it('converts PostgreSQL NUMERIC strings to the documented JSON number shape', () => {
    expect(productPriceTransformer.from('35000.00')).toBe(35000);
    expect(productPriceTransformer.to(35000)).toBe(35000);
  });

  it('rejects values that cannot fit NUMERIC(10,2)', () => {
    expect(() => productPriceTransformer.from('100000000.00')).toThrow(
      'NUMERIC(10,2) range',
    );
    expect(() => productPriceTransformer.from('NaN')).toThrow(
      'NUMERIC(10,2) range',
    );
  });
});
