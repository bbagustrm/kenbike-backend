// ✅ NEW BITESHIP WEBHOOK CONTROLLER - Save this as: src/order/biteship-webhook.controller.ts

import {
    Controller,
    Post,
    Body,
    Headers,
    HttpCode,
    HttpStatus,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { BiteshipWebhookService } from './biteship-webhook.service';

@Controller('webhooks/biteship')
export class BiteshipWebhookController {
    constructor(
        private biteshipWebhookService: BiteshipWebhookService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * POST /webhooks/biteship
     * Handle Biteship webhook events
     *
     * Biteship webhook payload example:
     * {
     *   "order_id": "biteship_order_id_here",
     *   "status": "delivered",
     *   "courier": {
     *     "tracking_id": "JNE123456789",
     *     "name": "JNE"
     *   },
     *   "updated_at": "2024-01-15T10:00:00Z"
     * }
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Body() payload: any,
        @Headers('x-biteship-signature') signature?: string,
    ) {
        try {
            this.logger.info('📨 Biteship webhook received', {
                orderId: payload?.order_id,
                status: payload?.status,
                signature: signature ? 'present' : 'missing',
            });

            // Validate webhook signature (if configured)
            // Note: Biteship may send signature in headers for security
            // Uncomment this when you have webhook secret configured
            // if (signature) {
            //     const isValid = await this.biteshipWebhookService.verifySignature(
            //         payload,
            //         signature,
            //     );
            //     if (!isValid) {
            //         this.logger.warn('⚠️ Invalid webhook signature');
            //         throw new BadRequestException('Invalid signature');
            //     }
            // }

            // Validate required fields
            if (!payload?.order_id || !payload?.status) {
                this.logger.warn('⚠️ Invalid webhook payload', { payload });
                throw new BadRequestException('Missing required fields: order_id or status');
            }

            // Process the webhook
            await this.biteshipWebhookService.processWebhook(payload);

            return {
                success: true,
                message: 'Webhook processed successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ Webhook processing failed', {
                error: error.message,
                payload,
            });

            // Return 200 even on error to prevent Biteship from retrying
            // But log the error for investigation
            return {
                success: false,
                message: error.message,
            };
        }
    }
}