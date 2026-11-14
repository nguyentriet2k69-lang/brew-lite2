import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = configService.getOrThrow<string[]>('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const emptyItems = errors.some(
          (error) => error.property === 'items' && error.constraints?.arrayNotEmpty,
        );
        const invalidPaymentMethod = errors.some((error) => error.property === 'method');
        return new BadRequestException({
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
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('BrewLite API')
    .setDescription('Tài liệu API cho dự án BrewLite')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(configService.getOrThrow<number>('PORT'));
}
void bootstrap();
