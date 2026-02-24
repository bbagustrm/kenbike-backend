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
import { InvoiceModule } from './invoice/invoice.module';
import { DiscussionController } from './discussion/discussion.controller';
import { DiscussionService } from './discussion/discussion.service';
import { DiscussionModule } from './discussion/discussion.module';
import {ReviewModule} from "./review/review.module";
import { NotificationModule } from './notification/notification.module';
import { AnalyticsModule } from './analytics/analytics.module';
import {ConfigModule, ConfigService} from '@nestjs/config';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    AuthModule,
    UserModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isLoadTest = config.get('`LOAD_TEST_MODE') === 'true';
        const enabled = config.get('RATE_LIMIT_ENABLED') !== 'false';

        // Saat load test atau disabled → limit sangat tinggi
        if (isLoadTest || !enabled) {
          return [{
            name: 'loadtest',
            ttl: 1000,
            limit: 999999,
          }];
        }

        // Production normal
        return [
          { name: 'short',  ttl: 1000,   limit: 10  },
          { name: 'medium', ttl: 60000,  limit: 100 },
          { name: 'long',   ttl: 900000, limit: 500 },
        ];
      },
    }),
    ProductModule,
    CategoryModule,
    TagModule,
    PromotionModule,
    StorageModule,
    UploadModule,
    CartModule,
    OrderModule,
    PaymentModule,
    InvoiceModule,
    ReviewModule,
    DiscussionModule,
    NotificationModule,
    AnalyticsModule,
    RedisModule,
    HealthModule,
  ],
  controllers: [AppController, DiscussionController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    DiscussionService,
  ],
})
export class AppModule {}