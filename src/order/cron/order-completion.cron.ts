// src/order/cron/order-completion.cron.ts

import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { OrderService } from '../order.service';

@Injectable()
export class OrderCompletionCron {
    constructor(
        private orderService: OrderService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * Auto-complete delivered orders after 3 days
     * Runs daily at midnight
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        name: 'auto-complete-orders',
        timeZone: 'Asia/Jakarta', // Adjust to your timezone
    })
    async handleAutoCompleteOrders() {
        this.logger.info('⏰ Cron: Starting auto-complete for delivered orders');

        try {
            const result = await this.orderService.autoCompleteDeliveredOrders();

            if (result.completed > 0) {
                this.logger.info(`✅ Cron: Auto-completed ${result.completed} orders`, {
                    orders: result.orders,
                });
            } else {
                this.logger.info('✅ Cron: No orders to auto-complete');
            }
        } catch (error: any) {
            this.logger.error('❌ Cron: Failed to auto-complete orders', {
                error: error.message,
            });
        }
    }

    /**
     * Manual trigger for testing (optional)
     * You can call this from an admin endpoint for testing
     */
    async triggerManually() {
        this.logger.info('🔧 Manual trigger: Auto-completing delivered orders');
        return await this.orderService.autoCompleteDeliveredOrders();
    }
}