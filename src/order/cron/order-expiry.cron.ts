// src/order/cron/order-expiry.cron.ts

import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrderExpiryCron {
    private readonly timeoutHours: number;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.timeoutHours = parseInt(
            this.configService.get<string>('ORDER_PAYMENT_TIMEOUT_HOURS') || '24'
        );

        this.logger.info('⏰ OrderExpiryCron initialized', {
            timeoutHours: this.timeoutHours,
        });
    }

    /**
     * ✅ Run every hour to check for expired orders
     * Cron expression: "0 * * * *" = At minute 0 of every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async cancelExpiredOrders() {
        this.logger.info('⏰ Starting order expiry check');

        try {
            // Calculate cutoff date (current time - timeout hours)
            const cutoffDate = new Date();
            cutoffDate.setHours(cutoffDate.getHours() - this.timeoutHours);

            this.logger.info('🔍 Searching for expired orders', {
                cutoffDate: cutoffDate.toISOString(),
                timeoutHours: this.timeoutHours,
            });

            // Find all PENDING orders older than timeout
            const expiredOrders = await this.prisma.order.findMany({
                where: {
                    status: 'PENDING',
                    createdAt: {
                        lte: cutoffDate,
                    },
                },
                include: {
                    items: true,
                    user: {
                        select: {
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            if (expiredOrders.length === 0) {
                this.logger.info('✅ No expired orders found');
                return { cancelled: 0 };
            }

            this.logger.info(`📦 Found ${expiredOrders.length} expired orders`, {
                orderNumbers: expiredOrders.map(o => o.orderNumber),
            });

            // Cancel orders and restore stock
            let successCount = 0;
            let failCount = 0;

            for (const order of expiredOrders) {
                try {
                    await this.cancelOrderAndRestoreStock(order);
                    successCount++;
                } catch (error: any) {
                    failCount++;
                    this.logger.error('❌ Failed to cancel order', {
                        orderNumber: order.orderNumber,
                        error: error.message,
                    });
                }
            }

            this.logger.info('✅ Order expiry check completed', {
                total: expiredOrders.length,
                success: successCount,
                failed: failCount,
            });

            // TODO: Send batch email notification to customers about cancelled orders
            // await this.emailService.sendOrderExpiredNotifications(expiredOrders);

            return {
                cancelled: successCount,
                failed: failCount,
                orders: expiredOrders.map(o => ({
                    orderNumber: o.orderNumber,
                    createdAt: o.createdAt,
                    total: o.total,
                })),
            };
        } catch (error: any) {
            this.logger.error('❌ Order expiry check failed', {
                error: error.message,
                stack: error.stack,
            });

            // Don't throw - cron should continue running
            return { cancelled: 0, error: error.message };
        }
    }

    /**
     * ✅ Cancel order and restore stock in transaction
     */
    private async cancelOrderAndRestoreStock(order: any) {
        this.logger.info('⚙️ Cancelling expired order', {
            orderNumber: order.orderNumber,
            createdAt: order.createdAt,
            ageHours: Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60)),
        });

        await this.prisma.$transaction(async (tx) => {
            // Step 1: Update order status to CANCELLED
            await tx.order.update({
                where: { id: order.id },
                data: {
                    status: 'CANCELLED',
                    canceledAt: new Date(),
                },
            });

            // Step 2: Restore stock for all items
            for (const item of order.items) {
                if (item.variantId) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: {
                            stock: {
                                increment: item.quantity,
                            },
                        },
                    });

                    this.logger.info('📦 Stock restored', {
                        variantId: item.variantId,
                        sku: item.sku,
                        quantity: item.quantity,
                    });
                }
            }
        });

        this.logger.info('✅ Order cancelled and stock restored', {
            orderNumber: order.orderNumber,
            itemsCount: order.items.length,
        });
    }

    /**
     * ✅ Manual trigger for testing (can be called from admin controller)
     */
    async triggerManually() {
        this.logger.info('🔧 Manual trigger: Order expiry check');
        return await this.cancelExpiredOrders();
    }
}