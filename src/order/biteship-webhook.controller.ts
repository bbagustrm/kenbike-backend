// src/order/biteship-webhook.controller.ts

import {
    Controller,
    Post,
    Get,
    Body,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { BiteshipWebhookService } from './biteship-webhook.service';
import { BiteshipService } from './biteship.service';
import * as crypto from 'crypto';

@Controller('webhooks/biteship')
@Public()
export class BiteshipWebhookController {
    constructor(
        private biteshipWebhookService: BiteshipWebhookService,
        private biteshipService: BiteshipService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    @Get('health')
    @HttpCode(HttpStatus.OK)
    @SkipThrottle()
    healthCheck() {
        return {
            status: 'ok',
            message: 'Biteship webhook endpoint is healthy',
            timestamp: new Date().toISOString(),
            biteship_configured: this.biteshipService.isConfigured(),
        };
    }

    @Post()
    @HttpCode(HttpStatus.OK)
    @Throttle({ short: { limit: 10, ttl: 1000 } })
    @Throttle({ medium: { limit: 60, ttl: 60000 } })
    async handleWebhook(
        @Headers() headers: Record<string, string>,
        @Body() payload: any,
    ) {
        // Validate payload size
        if (JSON.stringify(payload).length > 50000) {
            this.logger.warn('⚠️ Biteship webhook payload too large');
            return { status: 'error', message: 'Payload too large' };
        }

        this.logger.info('📦 Biteship webhook received', {
            orderId: payload.order_id,
            status: payload.status,
            courierName: payload.courier?.name,
            trackingId: payload.courier?.tracking_id,
            timestamp: new Date().toISOString(),
        });

        try {
            // Optional: validate Biteship signature if secret is configured
            const webhookSecret = this.configService.get<string>('BITESHIP_WEBHOOK_SECRET');
            if (webhookSecret) {
                const signature = headers['x-biteship-signature'] || headers['x-api-key'];
                if (!signature || !this.validateSignature(payload, signature, webhookSecret)) {
                    this.logger.warn('⚠️ Invalid Biteship webhook signature', {
                        orderId: payload.order_id,
                    });
                    return { status: 'error', message: 'Invalid signature' };
                }
            }

            await this.biteshipWebhookService.processWebhook(payload);

            return {
                status: 'ok',
                message: 'Webhook processed successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ Failed to process Biteship webhook', {
                error: error.message,
                stack: error.stack,
                payload,
            });

            // Always return 200 to Biteship to prevent retries for internal errors
            return {
                status: 'ok',
                message: 'Webhook received',
            };
        }
    }

    private validateSignature(payload: any, signature: string, secret: string): boolean {
        try {
            const hmac = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(payload))
                .digest('hex');
            return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
        } catch {
            return false;
        }
    }
}