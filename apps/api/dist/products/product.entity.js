"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = exports.productPriceTransformer = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
exports.productPriceTransformer = {
    to: (value) => value,
    from: (value) => {
        const serialized = String(value);
        if (!/^-?\d{1,8}(?:\.\d{1,2})?$/.test(serialized)) {
            throw new Error('Product.basePrice is outside the NUMERIC(10,2) range.');
        }
        const amount = Number(serialized);
        if (!Number.isFinite(amount)) {
            throw new Error('Product.basePrice is not a finite number.');
        }
        return amount;
    },
};
let Product = class Product {
    id;
    name;
    basePrice;
    stock;
    imageUrl;
};
exports.Product = Product;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], Product.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], Product.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', {
        precision: 10,
        scale: 2,
        transformer: exports.productPriceTransformer,
    }),
    (0, swagger_1.ApiProperty)({ type: Number, example: 35000 }),
    __metadata("design:type", Number)
], Product.prototype, "basePrice", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], Product.prototype, "stock", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    (0, swagger_1.ApiProperty)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], Product.prototype, "imageUrl", void 0);
exports.Product = Product = __decorate([
    (0, typeorm_1.Entity)()
], Product);
//# sourceMappingURL=product.entity.js.map