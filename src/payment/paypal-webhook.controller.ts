import {
    Controller,
    Post,
    Body,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
    Get,
} from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PayPalService } from './paypal.service';
import { PaymentService } from './payment.service';

@Controller('webhooks/paypal')
@Public()
export class PayPalWebhookController {
    constructor(
        private paypalService: PayPalService,
        private paymentService: PaymentService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    @Get('health')
    @HttpCode(HttpStatus.OK)
    @SkipThrottle() // ✅ Skip rate limit
    healthCheck() {
        return {
            status: 'ok',
            message: 'PayPal webhook endpoint is healthy',
            timestamp: new Date().toISOString(),
        };
    }

    @Post()
    @HttpCode(HttpStatus.OK)
    @Throttle({ short: { limit: 5, ttl: 1000 } }) // ✅ Max 5 req/detik
    @Throttle({ medium: { limit: 20, ttl: 60000 } }) // ✅ Max 20 req/menit
    async handleWebhook(
        @Headers() headers: any,
        @Body() event: any,
    ) {
        // ✅ Validate payload size
        if (JSON.stringify(event).length > 50000) {
            this.logger.warn('⚠️ Webhook payload too large');
            return {
                status: 'error',
                message: 'Payload too large',
            };
        }

        this.logger.info('💳 PayPal webhook received', {
            eventType: event.event_type,
            resourceType: event.resource_type,
            timestamp: new Date().toISOString(),
        });

        try {
            if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
                const captureId = event.resource.id;
                const orderId = event.resource.supplementary_data?.related_ids?.order_id;

                if (orderId) {
                    const orderDetails = await this.paypalService.getOrderDetails(orderId);
                    const orderNumber = orderDetails.purchase_units[0].reference_id;

                    this.logger.info('💰 PayPal payment captured', {
                        paypalOrderId: orderId,
                        orderNumber,
                        captureId,
                    });

                    await this.paymentService.handlePaymentSuccess(orderNumber, 'PAYPAL', {
                        transaction_id: captureId,
                        paypal_order_id: orderId,
                    });
                }
            } else if (event.event_type === 'PAYMENT.CAPTURE.DENIED') {
                const orderId = event.resource.supplementary_data?.related_ids?.order_id;

                if (orderId) {
                    const orderDetails = await this.paypalService.getOrderDetails(orderId);
                    const orderNumber = orderDetails.purchase_units[0].reference_id;

                    this.logger.info('❌ PayPal payment denied', {
                        paypalOrderId: orderId,
                        orderNumber,
                    });

                    await this.paymentService.handlePaymentFailed(
                        orderNumber,
                        'PAYPAL',
                        'Payment capture denied',
                    );
                }
            } else {
                this.logger.info('ℹ️ PayPal webhook event not handled', {
                    eventType: event.event_type,
                });
            }

            return {
                status: 'ok',
                message: 'Webhook processed successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ PayPal webhook processing failed', {
                error: error.message,
                event,
            });

            return {
                status: 'ok',
                message: 'Error logged',
            };
        }
    }
}