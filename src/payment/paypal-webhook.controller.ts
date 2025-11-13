// src/payment/paypal-webhook.controller.ts

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
import { PayPalService } from './paypal.service';
import { PaymentService } from './payment.service';

@Controller('webhooks/paypal')
export class PayPalWebhookController {
    constructor(
        private paypalService: PayPalService,
        private paymentService: PaymentService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    @Get('health')
    @HttpCode(HttpStatus.OK)
    healthCheck() {
        return {
            status: 'ok',
            message: 'PayPal webhook endpoint is healthy',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * POST /webhooks/paypal
     * Handle PayPal webhook events
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Headers() headers: any,
        @Body() event: any,
    ) {
        this.logger.info('💳 PayPal webhook received', {
            eventType: event.event_type,
            resourceType: event.resource_type,
            timestamp: new Date().toISOString(),
        });

        try {
            // Handle different event types
            if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
                // Payment captured successfully
                const captureId = event.resource.id;
                const orderId = event.resource.supplementary_data?.related_ids?.order_id;

                if (orderId) {
                    // Get order details to find our order number
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
                // Payment denied
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

            // Return ok to prevent retries
            return {
                status: 'ok',
                message: 'Error logged',
            };
        }
    }
}