// src/order/biteship-webhook.controller.ts
import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Get,
    Inject,
} from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { BiteshipWebhookService } from './biteship-webhook.service';

@Controller('webhooks/biteship')
@Public()
export class BiteshipWebhookController {
    constructor(
        private biteshipWebhookService: BiteshipWebhookService,
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
        };
    }

    @Post()
    @HttpCode(HttpStatus.OK)
    @Throttle({ short: { limit: 5, ttl: 1000 } })
    @Throttle({ medium: { limit: 20, ttl: 60000 } })
    async handleWebhook(@Body() body: any) {
        if (!body || Object.keys(body).length === 0) {
            this.logger.info('✅ Biteship webhook installation test received (empty body)');
            return {
                status: 'ok',
                message: 'Webhook installation successful',
                timestamp: new Date().toISOString(),
            };
        }

        // Validate payload size
        if (JSON.stringify(body).length > 50000) {
            this.logger.warn('⚠️ Webhook payload too large');
            return {
                status: 'error',
                message: 'Payload too large',
            };
        }

        this.logger.info('📦 Biteship webhook received', {
            orderId: body.order_id,
            status: body.status,
            courier: body.courier?.name,
            trackingId: body.courier?.tracking_id,
            timestamp: new Date().toISOString(),
        });

        try {
            await this.biteshipWebhookService.processWebhook(body);

            this.logger.info('✅ Biteship webhook processed successfully', {
                orderId: body.order_id,
                status: body.status,
            });

            return {
                status: 'ok',
                message: 'Webhook processed successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ Failed to process Biteship webhook', {
                error: error.message,
                stack: error.stack,
                body,
            });

            return {
                status: 'error',
                message: 'Internal server error',
                error: error.message,
            };
        }
    }
}