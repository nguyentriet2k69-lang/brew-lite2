import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'brewlite',
      password: 'brewlite',
      database: 'brewlite',
      autoLoadEntities: true,
      synchronize: true, // Chỉ dùng ở dev
    }),
    ProductsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}