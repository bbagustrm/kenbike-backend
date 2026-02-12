// src/payment/midtrans-webhook.controller.ts

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
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { MidtransService } from './midtrans.service';
import { OrderService } from '../order/order.service';

@Controller('webhooks/midtrans')
@Public()
export class MidtransWebhookController {
    constructor(
        private midtransService: MidtransService,
        private orderService: OrderService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    @Get('health')
    @HttpCode(HttpStatus.OK)
    @SkipThrottle()
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

    @Post()
    @HttpCode(HttpStatus.OK)
    @Throttle({ short: { limit: 5, ttl: 1000 } })
    @Throttle({ medium: { limit: 20, ttl: 60000 } })
    async handleWebhook(@Body() notification: any) {
        // Validate payload size
        if (JSON.stringify(notification).length > 50000) {
            this.logger.warn('⚠️ Webhook payload too large', {
                size: JSON.stringify(notification).length,
            });
            return {
                status: 'error',
                code: 413,
                message: 'Payload too large',
            };
        }

        this.logger.info('📨 Midtrans webhook received', {
            orderId: notification.order_id,
            transactionStatus: notification.transaction_status,
            transactionId: notification.transaction_id,
            paymentType: notification.payment_type,
            grossAmount: notification.gross_amount,
            timestamp: new Date().toISOString(),
        });

        try {
            const isMidtransProduction = this.configService.get('MIDTRANS_IS_PRODUCTION') === 'true';

            this.logger.info('🔍 Midtrans mode check', {
                MIDTRANS_IS_PRODUCTION: this.configService.get('MIDTRANS_IS_PRODUCTION'),
                mode: isMidtransProduction ? 'PRODUCTION' : 'SANDBOX',
                signatureValidation: isMidtransProduction ? 'ENABLED' : 'DISABLED',
            });

            if (isMidtransProduction) {
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
                this.logger.info('⚠️ SANDBOX MODE: Skipping signature validation', {
                    orderId: notification.order_id,
                    message: 'Signature check bypassed for sandbox testing',
                    note: 'Switch MIDTRANS_IS_PRODUCTION=true for production',
                });
            }

            const orderNumber = notification.order_id;
            const transactionStatus = notification.transaction_status;
            const fraudStatus = notification.fraud_status;
            const transactionId = notification.transaction_id;

            // ✅ Handle payment status
            if (transactionStatus === 'capture') {
                if (fraudStatus === 'accept') {
                    // ✅ Payment success - mark as paid + create Biteship
                    await this.orderService.markOrderAsPaid(orderNumber);
                    this.logger.info('✅ Payment captured (credit card)', { orderNumber });
                } else if (fraudStatus === 'challenge') {
                    this.logger.info('⚠️ Payment challenge - manual review required', {
                        orderNumber,
                        fraudStatus,
                    });
                    // Keep order as PENDING until manual review
                } else {
                    // ✅ FIXED: Mark order as FAILED (fraud detected)
                    await this.orderService.markOrderAsFailed(orderNumber, 'Fraud detected');
                    this.logger.info('❌ Payment denied due to fraud', { orderNumber });
                }
            } else if (transactionStatus === 'settlement') {
                // ✅ Payment success - mark as paid + create Biteship
                await this.orderService.markOrderAsPaid(orderNumber);
                this.logger.info('✅ Payment settled successfully', {
                    orderNumber,
                    paymentType: notification.payment_type,
                });
            } else if (transactionStatus === 'pending') {
                this.logger.info('⏳ Payment pending', {
                    orderNumber,
                    paymentType: notification.payment_type,
                });
                // Order stays PENDING - no action needed
            } else if (transactionStatus === 'deny') {
                // ✅ FIXED: Mark order as FAILED (payment denied)
                await this.orderService.markOrderAsFailed(orderNumber, 'Payment denied by bank');
                this.logger.info('❌ Payment denied by bank', { orderNumber });
            } else if (transactionStatus === 'cancel' || transactionStatus === 'expire') {
                // ✅ Payment cancelled/expired - will be handled by expiry CRON
                this.logger.info('⏳ Payment cancelled/expired - will be handled by CRON', {
                    orderNumber,
                    status: transactionStatus,
                });
                // Order stays PENDING - expiry CRON will cancel it and restore stock
            } else {
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

            return {
                status: 'error',
                code: 500,
                message: 'Internal server error',
                error: error.message,
            };
        }
    }
}