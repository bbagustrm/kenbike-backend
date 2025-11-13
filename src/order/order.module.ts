//  src/order/order.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderController } from './order.controller';
import { AdminOrderController } from './admin-order.controller';
import { BiteshipWebhookController } from './biteship-webhook.controller';
import { OrderService } from './order.service';
import { BiteshipService } from './biteship.service';
import { BiteshipWebhookService } from './biteship-webhook.service';
import { InternationalShippingService } from './international-shipping.service';
import { OrderCompletionCron } from './cron/order-completion.cron';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
      ConfigModule,
      forwardRef(() => PaymentModule),
  ],
  controllers: [
    OrderController,
    AdminOrderController,
    BiteshipWebhookController,
  ],
  providers: [
    OrderService,
    BiteshipService,
    BiteshipWebhookService,
    InternationalShippingService,
    OrderCompletionCron,
    PrismaService,
    ValidationService,
  ],
  exports: [OrderService],
})
export class OrderModule {}