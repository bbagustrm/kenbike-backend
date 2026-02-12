// src/payment/payment.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { MidtransWebhookController } from './midtrans-webhook.controller';
import { PayPalWebhookController } from './paypal-webhook.controller';
import { PaymentService } from './payment.service';
import { MidtransService } from './midtrans.service';
import { PayPalService } from './paypal.service';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';
import { OrderModule } from '../order/order.module';

@Module({
    imports: [
        ConfigModule,
        OrderModule,
    ],
    controllers: [
        PaymentController,
        MidtransWebhookController,
        PayPalWebhookController,
    ],
    providers: [
        PaymentService,
        MidtransService,
        PayPalService,
        PrismaService,
        ValidationService,
    ],
    exports: [
        PaymentService, // Export for OrderModule if needed
        MidtransService,
        PayPalService,
    ],
})
export class PaymentModule {}