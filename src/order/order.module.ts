// src/order/order.module.ts

import { Module } from '@nestjs/common';
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
import { OrderExpiryCron } from './cron/order-expiry.cron';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';
import { InvoiceModule } from '../invoice/invoice.module';
import { NotificationModule } from '../notification/notification.module';
import { EmailService } from '../common/email.service';

@Module({
  imports: [
    InvoiceModule,
    NotificationModule,
    ConfigModule,
    ScheduleModule.forRoot(),
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
    OrderExpiryCron,
    PrismaService,
    ValidationService,
    EmailService,
  ],
  exports: [
    OrderService,
    BiteshipService,
    InternationalShippingService,
  ],
})
export class OrderModule {}