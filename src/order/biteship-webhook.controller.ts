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
import { Public } from '../common/decorators/public.decorator';
import { BiteshipWebhookService } from './biteship-webhook.service';

@Controller('webhooks/biteship')
@Public() // ✅ Mark entire controller as public
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
     * Biteship webhook handler
     * POST /webhooks/biteship
     *
     * Handles shipping status updates from Biteship
     *
     * Status flow:
     * - confirmed: Order confirmed by Biteship
     * - allocated: Courier allocated
     * - picking_up: Courier on the way to pickup
     * - picked: Package picked up by courier
     * - dropping_off: Courier on the way to deliver
     * - delivered: Package delivered successfully
     * - cancelled: Order cancelled
     * - rejected: Order rejected by courier
     * - returned: Package returned to sender
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(@Body() body: any) {
        // ✅ Handle empty body for Biteship installation test
        if (!body || Object.keys(body).length === 0) {
            this.logger.info('✅ Biteship webhook installation test received (empty body)');
            return {
                status: 'ok',
                message: 'Webhook installation successful',
                timestamp: new Date().toISOString(),
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
            // Process webhook
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

            // Return 200 to prevent Biteship from retrying
            // But log error for investigation
            return {
                status: 'error',
                message: 'Internal server error',
                error: error.message,
            };
        }
    }
}