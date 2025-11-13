// src/order/biteship-webhook.controller.ts

import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Inject,
    Get,
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
     * Health check endpoint
     * GET /webhooks/biteship/health
     */
    @Get('health')
    @HttpCode(HttpStatus.OK)
    healthCheck() {
        return {
            status: 'ok',
            message: 'Biteship webhook endpoint is healthy',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * POST /webhooks/biteship
     * Handle Biteship webhook events
     * CRITICAL: Must handle empty body for installation test!
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(@Body() body: any) {
        // ✅ CRITICAL: Biteship sends empty body for installation test
        if (!body || Object.keys(body).length === 0) {
            this.logger.info('📋 Biteship webhook installation test received');
            return {
                status: 'ok',
                message: 'Webhook installation successful',
            };
        }

        // Real webhook with data
        this.logger.info('📨 Biteship webhook received', {
            orderId: body.order_id || body.id,
            status: body.status,
            courier: body.courier?.company,
            timestamp: new Date().toISOString(),
        });

        try {
            await this.biteshipWebhookService.processWebhook(body);

            this.logger.info('✅ Biteship webhook processed', {
                orderId: body.order_id || body.id,
                status: body.status,
            });

            return {
                status: 'ok',
                message: 'Webhook processed successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ Failed to process Biteship webhook', {
                error: error.message,
                body,
            });

            return {
                status: 'ok',
                message: 'Error logged',
            };
        }
    }
}