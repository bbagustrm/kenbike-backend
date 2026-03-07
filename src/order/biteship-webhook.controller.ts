// src/order/biteship-webhook.controller.ts

import {
    Controller,
    Post,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
    Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { BiteshipWebhookService } from './biteship-webhook.service';
import { BiteshipService } from './biteship.service';
import { Request } from 'express';
import * as crypto from 'crypto';

@Controller('webhooks/biteship')
@Public()
@SkipThrottle()
export class BiteshipWebhookController {
    constructor(
        private biteshipWebhookService: BiteshipWebhookService,
        private biteshipService: BiteshipService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    @Get('health')
    @HttpCode(HttpStatus.OK)
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
    async handleWebhook(
        @Req() req: Request,
        @Headers() headers: Record<string, string>,
    ) {
        // ✅ Pakai req.body langsung dan fallback ke {} kalau kosong
        // Biteship kirim empty body saat installation test yang menyebabkan
        // JSON parser NestJS throw error sebelum masuk controller
        const payload = req.body && Object.keys(req.body).length > 0 ? req.body : {};

        // ✅ Empty body = Biteship installation test ping
        if (Object.keys(payload).length === 0) {
            this.logger.info('📦 Biteship webhook: installation test ping');
            return { status: 'ok', message: 'Webhook endpoint ready' };
        }

        // Validate payload size
        if (JSON.stringify(payload).length > 50000) {
            this.logger.warn('⚠️ Biteship webhook payload too large');
            return { status: 'ok', message: 'Payload too large' };
        }

        this.logger.info('📦 Biteship webhook received', {
            orderId: payload.order_id,
            status: payload.status,
            courierName: payload.courier?.name,
            trackingId: payload.courier?.tracking_id,
            timestamp: new Date().toISOString(),
        });

        try {
            // Optional: validate signature kalau BITESHIP_WEBHOOK_SECRET di-set
            const webhookSecret = this.configService.get<string>('BITESHIP_WEBHOOK_SECRET');
            if (webhookSecret) {
                const signature = headers['x-biteship-signature'] || headers['x-api-key'];
                if (!signature || !this.validateSignature(payload, signature, webhookSecret)) {
                    this.logger.warn('⚠️ Invalid Biteship webhook signature', {
                        orderId: payload.order_id,
                    });
                    return { status: 'ok', message: 'Invalid signature' };
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

            // Selalu return 200 agar Biteship tidak retry
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