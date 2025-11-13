// src/payment/midtrans-webhook.controller.ts

import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Inject,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MidtransService } from './midtrans.service';
import { PaymentService } from './payment.service';
import { MidtransNotification } from './interfaces/payment.interface';

@Controller('webhooks/midtrans')
export class MidtransWebhookController {
    constructor(
        private midtransService: MidtransService,
        private paymentService: PaymentService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * POST /api/v1/webhooks/midtrans
     * Handle Midtrans payment notifications
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Res() res: Response,
        @Body() notification: MidtransNotification,
    ) {
        try {
            this.logger.info('💳 Midtrans webhook received', {
                orderId: notification.order_id,
                transactionStatus: notification.transaction_status,
            });

            // Verify signature
            const isValid = this.midtransService.verifySignature(notification);

            if (!isValid) {
                this.logger.warn('⚠️ Invalid Midtrans webhook signature', {
                    orderId: notification.order_id,
                });
                res.status(HttpStatus.UNAUTHORIZED).json({
                    success: false,
                    message: 'Invalid signature',
                });
                return;
            }

            // Parse transaction status
            const orderStatus = this.midtransService.parseTransactionStatus(
                notification.transaction_status,
                notification.fraud_status,
            );

            this.logger.info('🔄 Processing Midtrans notification', {
                orderId: notification.order_id,
                transactionStatus: notification.transaction_status,
                orderStatus,
            });

            // Update order based on status
            if (orderStatus === 'PAID') {
                await this.paymentService.markOrderAsPaid(notification.order_id, {
                    paymentId: notification.transaction_id,
                    paymentProvider: 'midtrans',
                    paymentType: notification.payment_type,
                });
            } else if (orderStatus === 'FAILED' || orderStatus === 'EXPIRED') {
                await this.paymentService.markOrderAsFailed(
                    notification.order_id,
                    `${notification.transaction_status} - ${notification.status_message}`,
                );
            }

            this.logger.info('✅ Midtrans webhook processed successfully', {
                orderId: notification.order_id,
                orderStatus,
            });

            res.json({
                success: true,
                message: 'Webhook processed',
            });
        } catch (error: any) {
            this.logger.error('❌ Midtrans webhook processing failed', {
                error: error.message,
                notification,
            });

            // Return 200 to prevent Midtrans from retrying
            res.json({
                success: false,
                message: error.message,
            });
        }
    }
}