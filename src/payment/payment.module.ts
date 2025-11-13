// src/payment/payment.module.ts

import { Module, forwardRef  } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { MidtransWebhookController } from './midtrans-webhook.controller';
import { PayPalWebhookController } from './paypal-webhook.controller';
import { PaymentService } from './payment.service';
import { MidtransService } from './midtrans.service';
import { PayPalService } from './paypal.service';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';

@Module({
    imports: [ConfigModule, forwardRef(() => PaymentModule)],
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
    exports: [PaymentService],
})
export class PaymentModule {}