import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AppController } from './app.controller';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from "./category/category.module";
import { TagModule } from "./tag/tag.module";
import { PromotionModule } from "./promotion/promotion.module";
import { StorageModule } from './common/storage/storage.module';
import { UploadModule } from './upload/upload.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    AuthModule,
    UserModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,      // 1 detik
        limit: 10,      // Max 10 requests per detik per IP
      },
      {
        name: 'medium',
        ttl: 60000,     // 1 menit (60 detik)
        limit: 100,     // Max 100 requests per menit per IP
      },
      {
        name: 'long',
        ttl: 900000,    // 15 menit
        limit: 500,     // Max 500 requests per 15 menit per IP
      },
    ]),
    ProductModule,
    CategoryModule,
    TagModule,
    PromotionModule,
    StorageModule,
    UploadModule,
    CartModule,
    OrderModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}