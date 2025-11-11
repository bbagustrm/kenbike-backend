import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from '../common/prisma.service';
import * as crypto from 'crypto';

interface BiteshipOrderStatusWebhook {
    event: 'order.status';
    courier_tracking_id: string;
    courier_waybill_id: string;
    courier_company: string;
    courier_type: string;
    courier_driver_name?: string;
    courier_driver_phone?: string;
    courier_driver_photo_url?: string;
    courier_driver_plate_number?: string;
    courier_link?: string;
    order_id: string; // This is biteship_order_id
    order_price: number;
    status: string; // Biteship status: confirmed, allocated, picking_up, picked, dropping_off, delivered, rejected, cancelled, etc.
}

interface BiteshipOrderPriceWebhook {
    event: 'order.price';
    order_id: string;
    courier_tracking_id: string;
    courier_waybill_id: string;
    price: number;
    cash_on_delivery_fee: number;
    proof_of_delivery_fee: number;
    shippment_fee: number;
    status: string;
}

interface BiteshipOrderWaybillWebhook {
    event: 'order.waybill_id';
    order_id: string;
    courier_tracking_id: string;
    courier_waybill_id: string;
    status: string;
}

@Injectable()
export class BiteshipWebhookService {
    private readonly webhookSecret: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.webhookSecret = this.configService.get<string>('BITESHIP_WEBHOOK_SECRET') || '';
    }

    /**
     * Verify webhook signature from Biteship
     */
    verifyWebhookSignature(payload: any, signature?: string): boolean {
        // If no webhook secret configured, skip verification (for development)
        if (!this.webhookSecret) {
            this.logger.warn('⚠️  Biteship webhook secret not configured. Skipping signature verification.');
            return true;
        }

        if (!signature) {
            this.logger.error('❌ Missing webhook signature');
            return false;
        }

        try {
            // Create HMAC signature
            const hmac = crypto.createHmac('sha256', this.webhookSecret);
            const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');

            const isValid = signature === expectedSignature;

            if (!isValid) {
                this.logger.error('❌ Invalid webhook signature', {
                    received: signature,
                    expected: expectedSignature,
                });
            }

            return isValid;
        } catch (error: any) {
            this.logger.error('❌ Error verifying webhook signature', { error: error.message });
            return false;
        }
    }

    /**
     * Map Biteship status to our order status
     */
    private mapBiteshipStatus(biteshipStatus: string): string | null {
        const statusMap: Record<string, string> = {
            // Biteship statuses → Our order status
            'confirmed': null,        // Order confirmed by courier (still SHIPPED)
            'allocated': null,        // Driver allocated (still SHIPPED)
            'picking_up': null,       // Driver on the way to pickup (still SHIPPED)
            'picked': null,           // Package picked up by driver (still SHIPPED)
            'dropping_off': null,     // Driver on the way to deliver (still SHIPPED)
            'delivered': 'DELIVERED', // ✅ Package delivered → Update to DELIVERED
            'cancelled': 'CANCELLED', // Package cancelled → Update to CANCELLED
            'rejected': 'CANCELLED',  // Package rejected → Update to CANCELLED
            'returning': null,        // Package being returned (still SHIPPED)
            'returned': 'CANCELLED',  // Package returned → Update to CANCELLED
            'on_hold': null,          // Package on hold (still SHIPPED)
        };

        return statusMap[biteshipStatus.toLowerCase()] || null;
    }

    /**
     * Handle order status update webhook from Biteship
     */
    async handleOrderStatusUpdate(payload: BiteshipOrderStatusWebhook) {
        try {
            this.logger.info('📥 Biteship Webhook: Order status update received', {
                biteshipOrderId: payload.order_id,
                status: payload.status,
                trackingId: payload.courier_tracking_id,
            });

            // Find order by biteship_order_id
            const order = await this.prisma.order.findUnique({
                where: { biteshipOrderId: payload.order_id },
            });

            if (!order) {
                this.logger.warn('⚠️  Order not found for biteship_order_id', {
                    biteshipOrderId: payload.order_id,
                });
                return {
                    success: false,
                    message: 'Order not found',
                };
            }

            // Map Biteship status to our status
            const newStatus = this.mapBiteshipStatus(payload.status);

            // If status doesn't need update, just log and return
            if (!newStatus) {
                this.logger.info('ℹ️  Status does not require order update', {
                    orderNumber: order.orderNumber,
                    biteshipStatus: payload.status,
                });
                return {
                    success: true,
                    message: 'Status noted, no order update required',
                };
            }

            // Prevent downgrade (e.g., DELIVERED → SHIPPED)
            const statusPriority: Record<string, number> = {
                'PENDING': 1,
                'PAID': 2,
                'PROCESSING': 3,
                'SHIPPED': 4,
                'DELIVERED': 5,
                'COMPLETED': 6,
                'CANCELLED': 0,
                'FAILED': 0,
            };

            if (statusPriority[order.status] >= statusPriority[newStatus]) {
                this.logger.info('ℹ️  Order already at higher or equal status', {
                    orderNumber: order.orderNumber,
                    currentStatus: order.status,
                    webhookStatus: newStatus,
                });
                return {
                    success: true,
                    message: 'Order status already updated',
                };
            }

            // Update order status
            const updateData: any = {
                status: newStatus,
                trackingNumber: payload.courier_tracking_id || order.trackingNumber,
            };

            if (newStatus === 'DELIVERED') {
                updateData.deliveredAt = new Date();
                // ✅ Option 1: Auto-complete immediately
                // updateData.status = 'COMPLETED';
                // updateData.completedAt = new Date();

                // ✅ Option 2: Just mark as DELIVERED, let user/admin complete manually
                // (This is what we're doing)
            }

            if (newStatus === 'CANCELLED') {
                updateData.canceledAt = new Date();
            }

            const updatedOrder = await this.prisma.order.update({
                where: { id: order.id },
                data: updateData,
            });

            this.logger.info('✅ Order status updated via webhook', {
                orderNumber: order.orderNumber,
                from: order.status,
                to: newStatus,
                biteshipStatus: payload.status,
            });

            // TODO: Send email notification to customer
            // await this.emailService.sendStatusUpdateEmail(updatedOrder);

            return {
                success: true,
                message: 'Order status updated successfully',
                data: {
                    orderNumber: updatedOrder.orderNumber,
                    status: updatedOrder.status,
                    trackingNumber: updatedOrder.trackingNumber,
                },
            };
        } catch (error: any) {
            this.logger.error('❌ Error handling order status webhook', {
                error: error.message,
                payload,
            });
            throw error;
        }
    }

    /**
     * Handle order price update webhook from Biteship
     */
    async handleOrderPriceUpdate(payload: BiteshipOrderPriceWebhook) {
        try {
            this.logger.info('📥 Biteship Webhook: Order price update received', {
                biteshipOrderId: payload.order_id,
                newPrice: payload.price,
            });

            const order = await this.prisma.order.findUnique({
                where: { biteshipOrderId: payload.order_id },
            });

            if (!order) {
                this.logger.warn('⚠️  Order not found for biteship_order_id', {
                    biteshipOrderId: payload.order_id,
                });
                return {
                    success: false,
                    message: 'Order not found',
                };
            }

            // Update shipping cost if different
            if (order.shippingCost !== payload.price) {
                const priceDifference = payload.price - order.shippingCost;

                await this.prisma.order.update({
                    where: { id: order.id },
                    data: {
                        shippingCost: payload.price,
                        total: order.total + priceDifference,
                    },
                });

                this.logger.info('✅ Order price updated via webhook', {
                    orderNumber: order.orderNumber,
                    oldPrice: order.shippingCost,
                    newPrice: payload.price,
                    difference: priceDifference,
                });

                // TODO: Notify customer about price change
                // await this.emailService.sendPriceChangeEmail(order, priceDifference);
            }

            return {
                success: true,
                message: 'Order price updated successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ Error handling order price webhook', {
                error: error.message,
                payload,
            });
            throw error;
        }
    }

    /**
     * Handle order waybill ID update webhook from Biteship
     */
    async handleOrderWaybillUpdate(payload: BiteshipOrderWaybillWebhook) {
        try {
            this.logger.info('📥 Biteship Webhook: Waybill ID update received', {
                biteshipOrderId: payload.order_id,
                waybillId: payload.courier_waybill_id,
            });

            const order = await this.prisma.order.findUnique({
                where: { biteshipOrderId: payload.order_id },
            });

            if (!order) {
                this.logger.warn('⚠️  Order not found for biteship_order_id', {
                    biteshipOrderId: payload.order_id,
                });
                return {
                    success: false,
                    message: 'Order not found',
                };
            }

            // Update tracking number if changed
            if (order.trackingNumber !== payload.courier_waybill_id) {
                await this.prisma.order.update({
                    where: { id: order.id },
                    data: {
                        trackingNumber: payload.courier_waybill_id,
                    },
                });

                this.logger.info('✅ Tracking number updated via webhook', {
                    orderNumber: order.orderNumber,
                    oldTracking: order.trackingNumber,
                    newTracking: payload.courier_waybill_id,
                });

                // TODO: Notify customer about tracking number change
                // await this.emailService.sendTrackingUpdateEmail(order);
            }

            return {
                success: true,
                message: 'Waybill ID updated successfully',
            };
        } catch (error: any) {
            this.logger.error('❌ Error handling waybill ID webhook', {
                error: error.message,
                payload,
            });
            throw error;
        }
    }
}