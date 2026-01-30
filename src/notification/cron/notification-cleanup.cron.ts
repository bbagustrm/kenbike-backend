// src/notification/cron/notification-cleanup.cron.ts
import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../notification.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class NotificationCleanupCron {
    constructor(
        private notificationService: NotificationService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * Cleanup old read notifications every day at 3 AM
     * Deletes notifications that have been read and are older than 30 days
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async handleCleanup() {
        this.logger.info('🧹 Starting notification cleanup cron...');

        try {
            const result = await this.notificationService.cleanupOldNotifications();
            this.logger.info(`🧹 Notification cleanup completed: ${result.count} deleted`);
        } catch (error) {
            this.logger.error('❌ Notification cleanup failed:', error);
        }
    }
}