// src/order/order.module.ts
import { Module, forwardRef } from '@nestjs/common'; // ✅ ADD forwardRef
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { OrderController } from './order.controller';
import { AdminOrderController } from './admin-order.controller';
import { BiteshipWebhookController } from './biteship-webhook.controller';
import { OrderService } from './order.service';
import { BiteshipService } from './biteship.service';
import { InternationalShippingService } from './international-shipping.service';
import { BiteshipWebhookService } from './biteship-webhook.service';
import { OrderCompletionCron } from './cron/order-completion.cron';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';
import { PaymentModule } from '../payment/payment.module'; // ✅ ADD

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    forwardRef(() => PaymentModule), // ✅ ADD - Import PaymentModule dengan forwardRef
  ],
  controllers: [
    OrderController,
    AdminOrderController,
    BiteshipWebhookController,
  ],
  providers: [
    OrderService,
    BiteshipService,
    InternationalShippingService,
    BiteshipWebhookService,
    OrderCompletionCron,
    PrismaService,
    ValidationService,
  ],
  exports: [OrderService, BiteshipService],
})
export class OrderModule {}