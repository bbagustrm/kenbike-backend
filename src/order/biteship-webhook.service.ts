// ✅ NEW BITESHIP WEBHOOK SERVICE - Save this as: src/order/biteship-webhook.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { OrderService } from './order.service';

@Injectable()
export class BiteshipWebhookService {
    constructor(
        private orderService: OrderService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * Process Biteship webhook event
     */
    async processWebhook(payload: any) {
        const { order_id, status, courier, updated_at } = payload;

        this.logger.info('🔄 Processing Biteship webhook', {
            orderId: order_id,
            status,
            courier: courier?.name,
            trackingId: courier?.tracking_id,
            timestamp: updated_at,
        });

        try {
            // Delegate to OrderService for processing
            await this.orderService.processBiteshipWebhook(order_id, status, payload);

            this.logger.info('✅ Webhook processed successfully', {
                orderId: order_id,
                status,
            });
        } catch (error: any) {
            this.logger.error('❌ Webhook processing error', {
                orderId: order_id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Verify webhook signature (optional security feature)
     * Uncomment and implement when Biteship provides webhook secret
     */
    async verifySignature(payload: any, signature: string): Promise<boolean> {
        try {
            // Example implementation:
            // const webhookSecret = this.configService.get<string>('BITESHIP_WEBHOOK_SECRET');
            // const computedSignature = crypto
            //     .createHmac('sha256', webhookSecret)
            //     .update(JSON.stringify(payload))
            //     .digest('hex');
            // return computedSignature === signature;

            // For now, return true (no verification)
            return true;
        } catch (error) {
            this.logger.error('Failed to verify webhook signature', { error });
            return false;
        }
    }
}