// src/payment/paypal-webhook.controller.ts

import {
    Controller,
    Post,
    Body,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PayPalService } from './paypal.service';
import { PaymentService } from './payment.service';
import { PayPalWebhookEvent } from './interfaces/payment.interface';

@Controller('webhooks/paypal')
export class PayPalWebhookController {
    constructor(
        private paypalService: PayPalService,
        private paymentService: PaymentService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * POST /api/v1/webhooks/paypal
     * Handle PayPal webhook events
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Res() res: Response,
        @Headers() headers: any,
        @Body() event: PayPalWebhookEvent,
    ) {
        try {
            this.logger.info('💳 PayPal webhook received', {
                eventType: event.event_type,
                resourceType: event.resource_type,
            });

            // Verify webhook signature (optional, implement if needed)
            // const isValid = await this.paypalService.verifyWebhook(headers, event);
            // if (!isValid) {
            //     this.logger.warn('⚠️ Invalid PayPal webhook signature');
            //     res.status(HttpStatus.UNAUTHORIZED).json({
            //         success: false,
            //         message: 'Invalid signature',
            //     });
            //     return;
            // }

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

                    await this.paymentService.markOrderAsPaid(orderNumber, {
                        paymentId: captureId,
                        paymentProvider: 'paypal',
                    });
                } else {
                    this.logger.warn('⚠️ PayPal webhook missing order_id', { event });
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

                    await this.paymentService.markOrderAsFailed(
                        orderNumber,
                        'Payment capture denied',
                    );
                }
            } else {
                this.logger.info('ℹ️ PayPal webhook event not handled', {
                    eventType: event.event_type,
                });
            }

            this.logger.info('✅ PayPal webhook processed successfully', {
                eventType: event.event_type,
            });

            res.json({
                success: true,
                message: 'Webhook processed',
            });
        } catch (error: any) {
            this.logger.error('❌ PayPal webhook processing failed', {
                error: error.message,
                event,
            });

            // Return 200 to prevent PayPal from retrying
            res.json({
                success: false,
                message: error.message,
            });
        }
    }
}