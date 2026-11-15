import { ValueTransformer } from 'typeorm';
export declare const productPriceTransformer: ValueTransformer;
export declare class Product {
    id: string;
    name: string;
    basePrice: number;
    stock: number;
    imageUrl: string | null;
}
