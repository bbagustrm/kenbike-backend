// src/order/biteship-webhook.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { NotificationService } from '../notification/notification.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class BiteshipWebhookService {
    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * Process Biteship webhook payload
     */
    async processWebhook(payload: any) {
        const { order_id: biteshipOrderId, status, courier } = payload;

        if (!biteshipOrderId || !status) {
            this.logger.warn('⚠️ Invalid Biteship webhook payload', { payload });
            return;
        }

        this.logger.info('📦 Processing Biteship webhook', {
            biteshipOrderId,
            status,
            courier: courier?.name,
            trackingId: courier?.tracking_id,
        });

        // Find order by Biteship order ID
        const order = await this.prisma.order.findUnique({
            where: { biteshipOrderId },
        });

        if (!order) {
            this.logger.warn('⚠️ Order not found for Biteship webhook', { biteshipOrderId });
            return;
        }

        // Map Biteship status to internal order status
        const statusMap: Record<string, OrderStatus> = {
            'confirmed': OrderStatus.SHIPPED,
            'allocated': OrderStatus.SHIPPED,
            'picking_up': OrderStatus.SHIPPED,
            'picked': OrderStatus.SHIPPED,
            'dropping_off': OrderStatus.SHIPPED,
            'delivered': OrderStatus.DELIVERED,
            'rejected': OrderStatus.CANCELLED,
            'cancelled': OrderStatus.CANCELLED,
            'courier_not_found': OrderStatus.CANCELLED,
            'returned': OrderStatus.CANCELLED,
        };

        const newStatus = statusMap[status.toLowerCase()];

        if (!newStatus) {
            this.logger.warn('⚠️ Unknown Biteship status', { status, biteshipOrderId });
            return;
        }

        // Only update if status has changed
        if (order.status === newStatus) {
            this.logger.info('ℹ️ Order status unchanged', {
                orderNumber: order.orderNumber,
                status: newStatus,
            });
            return;
        }

        // Validate status transition
        const validTransitions: Record<string, OrderStatus[]> = {
            'PAID': [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            'PROCESSING': [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            'SHIPPED': [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
            'DELIVERED': [OrderStatus.COMPLETED],
        };

        const allowedTransitions = validTransitions[order.status] || [];
        if (!allowedTransitions.includes(newStatus)) {
            this.logger.warn('⚠️ Invalid status transition from webhook', {
                orderNumber: order.orderNumber,
                currentStatus: order.status,
                attemptedStatus: newStatus,
            });
            return;
        }

        // Prepare update data
        const updateData: any = {
            status: newStatus,
        };

        // Update tracking number if provided
        if (courier?.tracking_id && !order.trackingNumber) {
            updateData.trackingNumber = courier.tracking_id;
        }

        // Set timestamps based on new status
        if (newStatus === OrderStatus.SHIPPED && !order.shippedAt) {
            updateData.shippedAt = new Date();
        } else if (newStatus === OrderStatus.DELIVERED) {
            updateData.deliveredAt = new Date();
        } else if (newStatus === OrderStatus.CANCELLED) {
            updateData.canceledAt = new Date();
        }

        // Update order
        await this.prisma.order.update({
            where: { id: order.id },
            data: updateData,
        });

        try {
            await this.notificationService.notifyOrderStatusChange(
                order.userId,
                order.orderNumber,
                order.id,
                newStatus,
                'id', // Default Indonesian locale
            );

            this.logger.info('✅ Notification sent for Biteship status update', {
                orderNumber: order.orderNumber,
                status: newStatus,
            });
        } catch (error: any) {
            this.logger.error('❌ Failed to send Biteship status notification', {
                orderNumber: order.orderNumber,
                status: newStatus,
                error: error.message,
            });
        }

        this.logger.info('✅ Order status updated from Biteship webhook', {
            orderNumber: order.orderNumber,
            previousStatus: order.status,
            newStatus,
            trackingNumber: updateData.trackingNumber || order.trackingNumber,
        });

        // Handle stock restoration for cancelled orders
        if (newStatus === OrderStatus.CANCELLED && ['PAID', 'PROCESSING', 'SHIPPED'].includes(order.status)) {
            await this.restoreStockForCancelledOrder(order.id);
        }
    }

    /**
     * Restore stock for cancelled orders
     */
    private async restoreStockForCancelledOrder(orderId: string) {
        const orderItems = await this.prisma.orderItem.findMany({
            where: { orderId },
            select: { variantId: true, quantity: true },
        });

        for (const item of orderItems) {
            if (item.variantId) {
                await this.prisma.productVariant.update({
                    where: { id: item.variantId },
                    data: {
                        stock: {
                            increment: item.quantity,
                        },
                    },
                });

                this.logger.info('📦 Stock restored for cancelled order', {
                    orderId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                });
            }
        }
    }
}