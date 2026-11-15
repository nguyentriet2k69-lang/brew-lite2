import { ProductsService } from './products.service';
import { Product } from './product.entity';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    findAll(): Promise<Product[]>;
    create(createProductDto: CreateProductDto): Promise<Product>;
    remove(id: string): Promise<void>;
    update(id: string, updateProductDto: UpdateProductDto): Promise<Product | null>;
}
