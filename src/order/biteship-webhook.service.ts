// src/order/biteship-webhook.service.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class BiteshipWebhookService {
    constructor(
        private prisma: PrismaService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * Process Biteship webhook notification
     */
    async processWebhook(webhookData: any): Promise<void> {
        const { order_id, status, courier } = webhookData;

        // Find order by Biteship order ID
        const order = await this.prisma.order.findUnique({
            where: { biteshipOrderId: order_id },
        });

        if (!order) {
            this.logger.warn('⚠️ Order not found for Biteship order ID', {
                biteshipOrderId: order_id,
            });
            throw new NotFoundException('Order not found');
        }

        this.logger.info('🔄 Processing Biteship status update', {
            orderNumber: order.orderNumber,
            currentStatus: order.status,
            newBiteshipStatus: status,
        });

        // Update order based on Biteship status
        await this.updateOrderStatus(order.id, status, webhookData);
    }

    /**
     * Update order status based on Biteship status
     */
    private async updateOrderStatus(
        orderId: string,
        biteshipStatus: string,
        webhookData: any,
    ): Promise<void> {
        // Map Biteship status to our OrderStatus
        const statusMap: Record<string, string> = {
            confirmed: 'SHIPPED', // Order confirmed by Biteship
            allocated: 'SHIPPED', // Courier allocated
            picking_up: 'SHIPPED', // Courier on the way to pickup
            picked: 'SHIPPED', // Package picked up
            dropping_off: 'SHIPPED', // On the way to deliver
            on_hold: 'SHIPPED', // Package on hold
            delivered: 'DELIVERED', // Package delivered ✅
            cancelled: 'CANCELLED', // Order cancelled
            rejected: 'CANCELLED', // Rejected by courier
            courier_not_found: 'FAILED', // No courier found
            returned: 'CANCELLED', // Returned to sender
        };

        const newStatus = statusMap[biteshipStatus];

        if (!newStatus) {
            this.logger.warn('⚠️ Unknown Biteship status', {
                biteshipStatus,
                orderId,
            });
            return;
        }

        // Prepare update data
        const updateData: any = {
            status: newStatus,
        };

        // Update tracking number if available
        if (webhookData.courier?.tracking_id && !updateData.trackingNumber) {
            updateData.trackingNumber = webhookData.courier.tracking_id;
        }

        // Set timestamp based on status
        if (biteshipStatus === 'delivered') {
            updateData.deliveredAt = new Date();
        } else if (
            biteshipStatus === 'cancelled' ||
            biteshipStatus === 'rejected' ||
            biteshipStatus === 'returned'
        ) {
            updateData.canceledAt = new Date();
        }

        // Update order
        await this.prisma.order.update({
            where: { id: orderId },
            data: updateData,
        });

        this.logger.info('✅ Order status updated', {
            orderId,
            biteshipStatus,
            newStatus,
        });

        // TODO Phase 4: Send email notification to customer
    }

    /**
     * Get delivery status history from webhook data
     */
    private getDeliveryHistory(webhookData: any): any[] {
        if (!webhookData.history || !Array.isArray(webhookData.history)) {
            return [];
        }

        return webhookData.history.map((item: any) => ({
            status: item.status,
            note: item.note,
            updatedAt: item.updated_at,
        }));
    }
}