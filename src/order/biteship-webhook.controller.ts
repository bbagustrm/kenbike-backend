// src/order/biteship-webhook.controller.ts

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
     * POST /api/v1/webhooks/biteship
     * Handle Biteship webhook events
     *
     * ✅ FIXED: Return plain text "OK" for Biteship validation
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Body() payload: any,
        @Headers('x-biteship-signature') signature?: string,
    ) {
        try {
            // ✅ Handle Biteship connection test (empty payload)
            if (!payload || Object.keys(payload).length === 0) {
                this.logger.info('📨 Biteship webhook test/ping received');
                return 'OK';
            }

            this.logger.info('📨 Biteship webhook received', {
                orderId: payload?.order_id,
                status: payload?.status,
                signature: signature ? 'present' : 'missing',
            });

            // Validate required fields
            if (!payload?.order_id || !payload?.status) {
                this.logger.warn('⚠️ Invalid webhook payload', { payload });
                // ✅ Still return OK to prevent Biteship retries
                return 'OK';
            }

            // Process the webhook
            await this.biteshipWebhookService.processWebhook(payload);

            this.logger.info('✅ Webhook processed successfully', {
                orderId: payload.order_id,
                status: payload.status,
            });

            // ✅ Return plain text "OK"
            return 'OK';
        } catch (error: any) {
            this.logger.error('❌ Webhook processing failed', {
                error: error.message,
                payload,
            });

            // ✅ Return OK even on error to prevent Biteship retries
            // Log error for manual investigation
            return 'OK';
        }
    }
}