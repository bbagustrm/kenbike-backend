// src/notification/notification.controller.ts
import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import {
    QueryNotificationsSchema,
    QueryNotificationsDto,
    MarkAsReadSchema,
    MarkAsReadDto,
} from './dto/notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(
        private notificationService: NotificationService,
        private validationService: ValidationService,
    ) {}

    /**
     * GET /notifications
     * Get user's notifications with pagination
     */
    @Get()
    async getNotifications(
        @CurrentUser() user: CurrentUserData,
        @Query() query: QueryNotificationsDto,
    ) {
        const dto = this.validationService.validate(QueryNotificationsSchema, query);
        return this.notificationService.getUserNotifications(user.id, dto);
    }

    /**
     * GET /notifications/unread-count
     * Get unread notification count
     */
    @Get('unread-count')
    async getUnreadCount(@CurrentUser() user: CurrentUserData) {
        return this.notificationService.getUnreadCount(user.id);
    }

    /**
     * POST /notifications/mark-read
     * Mark specific notifications as read
     */
    @Post('mark-read')
    @HttpCode(HttpStatus.OK)
    async markAsRead(
        @CurrentUser() user: CurrentUserData,
        @Body() body: MarkAsReadDto,
    ) {
        const dto = this.validationService.validate(MarkAsReadSchema, body);
        return this.notificationService.markAsRead(user.id, dto);
    }

    /**
     * POST /notifications/mark-all-read
     * Mark all notifications as read
     */
    @Post('mark-all-read')
    @HttpCode(HttpStatus.OK)
    async markAllAsRead(@CurrentUser() user: CurrentUserData) {
        return this.notificationService.markAllAsRead(user.id);
    }

    /**
     * DELETE /notifications/:id
     * Delete a notification
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteNotification(
        @CurrentUser() user: CurrentUserData,
        @Param('id') notificationId: string,
    ) {
        return this.notificationService.deleteNotification(user.id, notificationId);
    }

    /**
     * DELETE /notifications/read/all
     * Delete all read notifications
     */
    @Delete('read/all')
    @HttpCode(HttpStatus.OK)
    async deleteAllRead(@CurrentUser() user: CurrentUserData) {
        return this.notificationService.deleteAllRead(user.id);
    }
}