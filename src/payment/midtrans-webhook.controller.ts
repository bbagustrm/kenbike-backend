// src/payment/midtrans-webhook.controller.ts

import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MidtransService } from './midtrans.service';
import { PaymentService } from './payment.service';

@Controller('webhooks/midtrans')
export class MidtransWebhookController {
    constructor(
        private midtransService: MidtransService,
        private paymentService: PaymentService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * ✅ FIXED: Midtrans webhook handler with dev mode signature bypass
     * POST /webhooks/midtrans
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(@Body() notification: any) {
        this.logger.info('📨 Midtrans webhook received', {
            orderId: notification.order_id,
            transactionStatus: notification.transaction_status,
            transactionId: notification.transaction_id,
            fraudStatus: notification.fraud_status,
        });

        try {
            // ✅ FIX: Skip signature validation in development mode
            const isDevelopment = this.configService.get('NODE_ENV') === 'development';

            if (!isDevelopment) {
                // Production: Validate signature
                const isValidSignature = await this.midtransService.verifySignature(notification);

                if (!isValidSignature) {
                    this.logger.warn('⚠️ Invalid Midtrans signature', {
                        orderId: notification.order_id,
                        receivedSignature: notification.signature_key?.substring(0, 20) + '...',
                    });
                    return {
                        success: false,
                        message: 'Invalid signature',
                    };
                }

                this.logger.info('✅ Signature verified', {
                    orderId: notification.order_id,
                });
            } else {
                this.logger.info('⚠️ DEV MODE: Skipping signature validation', {
                    orderId: notification.order_id,
                    environment: 'development',
                });
            }

            const orderNumber = notification.order_id;
            const transactionStatus = notification.transaction_status;
            const fraudStatus = notification.fraud_status;
            const transactionId = notification.transaction_id;

            // Process based on transaction status
            // Ref: https://docs.midtrans.com/en/after-payment/http-notification
            if (transactionStatus === 'capture') {
                // For credit card transactions
                if (fraudStatus === 'accept') {
                    await this.paymentService.handlePaymentSuccess(orderNumber, 'MIDTRANS', {
                        transaction_id: transactionId,
                        payment_type: notification.payment_type,
                        transaction_time: notification.transaction_time,
                        fraud_status: fraudStatus,
                    });
                    this.logger.info('✅ Payment captured (credit card)', { orderNumber });
                } else if (fraudStatus === 'challenge') {
                    this.logger.info('⚠️ Payment challenge - manual review required', {
                        orderNumber,
                        fraudStatus,
                    });
                } else {
                    // fraud_status = 'deny'
                    await this.paymentService.handlePaymentFailed(
                        orderNumber,
                        'MIDTRANS',
                        'Fraud detected',
                    );
                    this.logger.info('❌ Payment denied due to fraud', { orderNumber });
                }
            } else if (transactionStatus === 'settlement') {
                // Payment successful (non-card transactions)
                await this.paymentService.handlePaymentSuccess(orderNumber, 'MIDTRANS', {
                    transaction_id: transactionId,
                    payment_type: notification.payment_type,
                    transaction_time: notification.transaction_time,
                    settlement_time: notification.settlement_time,
                });
                this.logger.info('✅ Payment settled', { orderNumber });
            } else if (transactionStatus === 'pending') {
                // Payment pending (e.g., waiting for bank transfer)
                this.logger.info('⏳ Payment pending', {
                    orderNumber,
                    paymentType: notification.payment_type,
                });
                // No action needed - order stays in PENDING status
            } else if (transactionStatus === 'deny') {
                // Payment denied by bank/payment gateway
                await this.paymentService.handlePaymentFailed(
                    orderNumber,
                    'MIDTRANS',
                    'Payment denied',
                );
                this.logger.info('❌ Payment denied', { orderNumber });
            } else if (transactionStatus === 'cancel' || transactionStatus === 'expire') {
                // Payment cancelled by user or expired
                await this.paymentService.handlePaymentExpired(orderNumber, 'MIDTRANS');
                this.logger.info('❌ Payment cancelled/expired', {
                    orderNumber,
                    status: transactionStatus,
                });
            } else {
                // Unknown status
                this.logger.warn('⚠️ Unknown transaction status', {
                    orderNumber,
                    transactionStatus,
                });
            }

            return {
                success: true,
                message: 'Webhook processed successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ Failed to process Midtrans webhook', {
                error: error.message,
                stack: error.stack,
                notification,
            });

            // Don't throw error to Midtrans - return 200 to prevent retries
            // But log the error for investigation
            return {
                success: false,
                message: 'Internal server error',
                error: error.message,
            };
        }
    }

    /**
     * ✅ NEW: Health check endpoint for webhook
     * GET /webhooks/midtrans/health
     */
    @Post('health')
    @HttpCode(HttpStatus.OK)
    healthCheck() {
        return {
            success: true,
            message: 'Midtrans webhook endpoint is healthy',
            timestamp: new Date().toISOString(),
            environment: this.configService.get('NODE_ENV'),
        };
    }
}