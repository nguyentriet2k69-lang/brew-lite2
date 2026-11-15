"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const products_module_1 = require("./products/products.module");
const health_controller_1 = require("./health.controller");
const environment_1 = require("./config/environment");
const database_1 = require("./config/database");
const _1760000000000_create_product_baseline_1 = require("./database/migrations/1760000000000-create-product-baseline");
const _1761000000000_create_users_table_1 = require("./database/migrations/1761000000000-create-users-table");
const auth_module_1 = require("./auth/auth.module");
const pricing_module_1 = require("./pricing/pricing.module");
const _1762000000000_create_orders_inventory_1 = require("./database/migrations/1762000000000-create-orders-inventory");
const orders_module_1 = require("./orders/orders.module");
const inventory_module_1 = require("./inventory/inventory.module");
const schedule_1 = require("@nestjs/schedule");
const _1763000000000_create_payment_attempts_1 = require("./database/migrations/1763000000000-create-payment-attempts");
const payments_module_1 = require("./payments/payments.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: (0, environment_1.getEnvFilePaths)(),
                validate: environment_1.validateEnvironment,
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                useFactory: () => ({
                    ...(0, database_1.getNestPostgresOptions)(process.env),
                    autoLoadEntities: true,
                    migrations: [
                        _1760000000000_create_product_baseline_1.CreateProductBaseline1760000000000,
                        _1761000000000_create_users_table_1.CreateUsersTable1761000000000,
                        _1762000000000_create_orders_inventory_1.CreateOrdersInventory1762000000000,
                        _1763000000000_create_payment_attempts_1.CreatePaymentAttempts1763000000000,
                    ],
                    retryAttempts: 1,
                    retryDelay: 1000,
                }),
            }),
            products_module_1.ProductsModule,
            auth_module_1.AuthModule,
            pricing_module_1.PricingModule,
            orders_module_1.OrdersModule,
            inventory_module_1.InventoryModule,
            payments_module_1.PaymentsModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map