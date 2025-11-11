import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderController } from './order.controller';
import { AdminOrderController } from './admin-order.controller';
import { BiteshipWebhookController } from './biteship-webhook.controller';
import { OrderService } from './order.service';
import { BiteshipService } from './biteship.service';
import { BiteshipWebhookService } from './biteship-webhook.service';
import { InternationalShippingService } from './international-shipping.service';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';

@Module({
  imports: [ConfigModule],
  controllers: [
    OrderController,
    AdminOrderController,
    BiteshipWebhookController, // ✅ NEW: Webhook controller
  ],
  providers: [
    OrderService,
    BiteshipService,
    BiteshipWebhookService, // ✅ NEW: Webhook service
    InternationalShippingService,
    PrismaService,
    ValidationService,
  ],
  exports: [OrderService, BiteshipWebhookService],
})
export class OrderModule {}