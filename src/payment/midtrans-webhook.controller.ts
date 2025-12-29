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
import { PaymentService } from './payment.service';

@Controller('webhooks/midtrans')
@Public()
export class MidtransWebhookController {
    constructor(
        private midtransService: MidtransService,
        private paymentService: PaymentService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    @Get('health')
    @HttpCode(HttpStatus.OK)
    @SkipThrottle() // ✅ Skip rate limit untuk health check
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
    @Throttle({ short: { limit: 5, ttl: 1000 } }) // ✅ Max 5 req/detik untuk webhook
    @Throttle({ medium: { limit: 20, ttl: 60000 } }) // ✅ Max 20 req/menit
    async handleWebhook(@Body() notification: any) {
        // ✅ Validate payload size
        if (JSON.stringify(notification).length > 50000) { // 50KB limit
            this.logger.warn('⚠️ Webhook payload too large', {
                size: JSON.stringify(notification).length,
            });
            return {
                status: 'error',
                code: 413,
                message: 'Payload too large',
            };
        }

        // ... rest of your existing code
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

            if (transactionStatus === 'capture') {
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
                    await this.paymentService.handlePaymentFailed(
                        orderNumber,
                        'MIDTRANS',
                        'Fraud detected',
                    );
                    this.logger.info('❌ Payment denied due to fraud', { orderNumber });
                }
            } else if (transactionStatus === 'settlement') {
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
                this.logger.info('⏳ Payment pending', {
                    orderNumber,
                    paymentType: notification.payment_type,
                });
            } else if (transactionStatus === 'deny') {
                await this.paymentService.handlePaymentFailed(
                    orderNumber,
                    'MIDTRANS',
                    'Payment denied by bank',
                );
                this.logger.info('❌ Payment denied by bank', { orderNumber });
            } else if (transactionStatus === 'cancel' || transactionStatus === 'expire') {
                await this.paymentService.handlePaymentExpired(orderNumber, 'MIDTRANS');
                this.logger.info('❌ Payment cancelled/expired', {
                    orderNumber,
                    status: transactionStatus,
                });
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