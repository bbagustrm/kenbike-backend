// src/payment/midtrans-webhook.controller.ts
// ✅ PRODUCTION-READY: Auto-switches between sandbox and production

import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Get,
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
     * Health check endpoint
     * GET /webhooks/midtrans/health
     */
    @Get('health')
    @HttpCode(HttpStatus.OK)
    healthCheck() {
        const isMidtransProduction = this.configService.get('MIDTRANS_IS_PRODUCTION') === 'true';
        const isConfigured = this.midtransService.isConfigured();

        return {
            status: 'ok',
            message: 'Midtrans webhook endpoint is healthy',
            timestamp: new Date().toISOString(),
            midtrans_mode: isMidtransProduction ? 'PRODUCTION' : 'SANDBOX',
            signature_validation: isMidtransProduction ? 'ENABLED' : 'DISABLED',
            midtrans_configured: isConfigured,
        };
    }

    /**
     * ✅ PRODUCTION-READY: Midtrans webhook handler
     * - Sandbox Mode (MIDTRANS_IS_PRODUCTION=false): Skips signature validation for testing
     * - Production Mode (MIDTRANS_IS_PRODUCTION=true): Validates signature for security
     *
     * POST /webhooks/midtrans
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(@Body() notification: any) {
        // Log incoming webhook
        this.logger.info('📨 Midtrans webhook received', {
            orderId: notification.order_id,
            transactionStatus: notification.transaction_status,
            transactionId: notification.transaction_id,
            paymentType: notification.payment_type,
            grossAmount: notification.gross_amount,
            timestamp: new Date().toISOString(),
        });

        try {
            // ✅ Check if using Production or Sandbox Midtrans
            const isMidtransProduction = this.configService.get('MIDTRANS_IS_PRODUCTION') === 'true';

            this.logger.info('🔍 Midtrans mode check', {
                MIDTRANS_IS_PRODUCTION: this.configService.get('MIDTRANS_IS_PRODUCTION'),
                mode: isMidtransProduction ? 'PRODUCTION' : 'SANDBOX',
                signatureValidation: isMidtransProduction ? 'ENABLED' : 'DISABLED',
            });

            // ✅ Signature validation logic
            if (isMidtransProduction) {
                // PRODUCTION MIDTRANS: Validate signature for security
                this.logger.info('🔐 Production Midtrans: Validating signature');

                const isValidSignature = await this.midtransService.verifySignature(notification);

                if (!isValidSignature) {
                    this.logger.warn('⚠️ Invalid Midtrans signature - Possible fraud attempt', {
                        orderId: notification.order_id,
                        receivedSignature: notification.signature_key?.substring(0, 20) + '...',
                        statusCode: notification.status_code,
                        grossAmount: notification.gross_amount,
                    });

                    return {
                        status: 'error',
                        code: 400,
                        message: 'Invalid signature',
                    };
                }

                this.logger.info('✅ Signature verified successfully');
            } else {
                // SANDBOX MIDTRANS: Skip signature validation for testing
                this.logger.info('⚠️ SANDBOX MODE: Skipping signature validation', {
                    orderId: notification.order_id,
                    message: 'Signature check bypassed for sandbox testing',
                    note: 'Switch MIDTRANS_IS_PRODUCTION=true for production',
                });
            }

            // Extract webhook data
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
                    // Don't update order - wait for manual review
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
                // Payment successful (non-card transactions like bank transfer, e-wallet)
                await this.paymentService.handlePaymentSuccess(orderNumber, 'MIDTRANS', {
                    transaction_id: transactionId,
                    payment_type: notification.payment_type,
                    transaction_time: notification.transaction_time,
                    settlement_time: notification.settlement_time,
                });
                this.logger.info('✅ Payment settled successfully', {
                    orderNumber,
                    paymentType: notification.payment_type,
                });
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
                    'Payment denied by bank',
                );
                this.logger.info('❌ Payment denied by bank', { orderNumber });
            } else if (transactionStatus === 'cancel' || transactionStatus === 'expire') {
                // Payment cancelled by user or expired
                await this.paymentService.handlePaymentExpired(orderNumber, 'MIDTRANS');
                this.logger.info('❌ Payment cancelled/expired', {
                    orderNumber,
                    status: transactionStatus,
                });
            } else {
                // Unknown status - log for investigation
                this.logger.warn('⚠️ Unknown transaction status received', {
                    orderNumber,
                    transactionStatus,
                    notification,
                });
            }

            return {
                status: 'ok',
                code: 200,
                message: 'Webhook processed successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ Failed to process Midtrans webhook', {
                error: error.message,
                stack: error.stack,
                notification,
            });

            // Return 200 to prevent Midtrans from retrying
            // But log error for investigation
            return {
                status: 'error',
                code: 500,
                message: 'Internal server error',
                error: error.message,
            };
        }
    }
}