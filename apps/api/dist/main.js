"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const http_exception_filter_1 = require("./common/http-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const corsOrigins = configService.getOrThrow('CORS_ORIGIN');
    app.enableCors({
        origin: corsOrigins,
        methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: false,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
            const emptyItems = errors.some((error) => error.property === 'items' && error.constraints?.arrayNotEmpty);
            const invalidPaymentMethod = errors.some((error) => error.property === 'method');
            return new common_1.BadRequestException({
                code: emptyItems
                    ? 'INVALID_ORDER_ITEMS'
                    : invalidPaymentMethod
                        ? 'INVALID_PAYMENT_METHOD'
                        : 'VALIDATION_ERROR',
                message: emptyItems
                    ? 'At least one order item is required.'
                    : invalidPaymentMethod
                        ? 'method must be CARD or WALLET.'
                        : 'Request validation failed.',
                details: errors.map((error) => ({
                    property: error.property,
                    constraints: Object.values(error.constraints ?? {}),
                })),
            });
        },
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const config = new swagger_1.DocumentBuilder()
        .setTitle('BrewLite API')
        .setDescription('Tài liệu API cho dự án BrewLite')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api-docs', app, document);
    await app.listen(configService.getOrThrow('PORT'));
}
void bootstrap();
//# sourceMappingURL=main.js.map