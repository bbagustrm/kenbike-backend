// src/notification/notification.module.ts
import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationCleanupCron } from './cron/notification-cleanup.cron';
import { CommonModule } from '../common/common.module';

@Global()
@Module({
  imports: [CommonModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationCleanupCron],
  exports: [NotificationService],
})
export class NotificationModule {}