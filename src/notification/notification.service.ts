// src/notification/notification.service.ts
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaginationUtil } from '../utils/pagination.util';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { NotificationType, OrderStatus, Prisma } from '@prisma/client';
import {
    CreateNotificationDto,
    QueryNotificationsDto,
    MarkAsReadDto,
    BulkCreateNotificationDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationService {
    constructor(
        private prisma: PrismaService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    // ==========================================
    // USER METHODS
    // ==========================================

    /**
     * Get notifications for a user
     */
    async getUserNotifications(userId: string, dto: QueryNotificationsDto) {
        const { page, limit, isRead, type } = dto;
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: Prisma.NotificationWhereInput = {
            userId,
        };

        if (isRead !== undefined) {
            where.isRead = isRead;
        }

        if (type) {
            where.type = type as NotificationType;
        }

        const [total, notifications] = await Promise.all([
            this.prisma.notification.count({ where }),
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: PaginationUtil.getSkip(validPage, validLimit),
                take: validLimit,
            }),
        ]);

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data: notifications,
        };
    }

    /**
     * Get unread count for a user
     */
    async getUnreadCount(userId: string) {
        const count = await this.prisma.notification.count({
            where: {
                userId,
                isRead: false,
            },
        });

        return { data: { unreadCount: count } };
    }

    /**
     * Mark notifications as read
     */
    async markAsRead(userId: string, dto: MarkAsReadDto) {
        const { notificationIds } = dto;

        // Verify all notifications belong to user
        const notifications = await this.prisma.notification.findMany({
            where: {
                id: { in: notificationIds },
                userId,
            },
            select: { id: true },
        });

        if (notifications.length !== notificationIds.length) {
            throw new ForbiddenException('Some notifications do not belong to you');
        }

        await this.prisma.notification.updateMany({
            where: {
                id: { in: notificationIds },
                userId,
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });

        this.logger.info(`✅ Marked ${notificationIds.length} notifications as read for user ${userId}`);

        return {
            message: 'Notifications marked as read',
            data: { count: notificationIds.length },
        };
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string) {
        const result = await this.prisma.notification.updateMany({
            where: {
                userId,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });

        this.logger.info(`✅ Marked all (${result.count}) notifications as read for user ${userId}`);

        return {
            message: 'All notifications marked as read',
            data: { count: result.count },
        };
    }

    /**
     * Delete a notification
     */
    async deleteNotification(userId: string, notificationId: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        if (notification.userId !== userId) {
            throw new ForbiddenException('You can only delete your own notifications');
        }

        await this.prisma.notification.delete({
            where: { id: notificationId },
        });

        this.logger.info(`🗑️ Notification ${notificationId} deleted by user ${userId}`);

        return { message: 'Notification deleted' };
    }

    /**
     * Delete all read notifications for a user
     */
    async deleteAllRead(userId: string) {
        const result = await this.prisma.notification.deleteMany({
            where: {
                userId,
                isRead: true,
            },
        });

        this.logger.info(`🗑️ Deleted ${result.count} read notifications for user ${userId}`);

        return {
            message: 'Read notifications deleted',
            data: { count: result.count },
        };
    }

    // ==========================================
    // INTERNAL METHODS (for creating notifications)
    // ==========================================

    /**
     * Create a single notification (internal)
     */
    async createNotification(dto: CreateNotificationDto) {
        const notification = await this.prisma.notification.create({
            data: {
                userId: dto.userId,
                type: dto.type as NotificationType,
                title: dto.title,
                message: dto.message,
                data: (dto.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
                imageUrl: dto.imageUrl ?? null,
                actionUrl: dto.actionUrl ?? null,
            },
        });

        this.logger.info(`🔔 Notification created: ${notification.id} (${dto.type}) for user ${dto.userId}`);

        return notification;
    }

    /**
     * Create notifications for multiple users (for promotions)
     */
    async createBulkNotifications(dto: BulkCreateNotificationDto) {
        const dataToCreate: Prisma.NotificationCreateManyInput[] = dto.userIds.map((userId) => ({
            userId,
            type: dto.type as NotificationType,
            title: dto.title,
            message: dto.message,
            data: (dto.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            imageUrl: dto.imageUrl ?? null,
            actionUrl: dto.actionUrl ?? null,
        }));

        const notifications = await this.prisma.notification.createMany({
            data: dataToCreate,
        });

        this.logger.info(`🔔 Bulk notifications created: ${notifications.count} for ${dto.type}`);

        return notifications;
    }

    // ==========================================
    // ORDER NOTIFICATION HELPERS
    // ==========================================

    /**
     * Create order status notification
     */
    async notifyOrderStatusChange(
        userId: string,
        orderNumber: string,
        orderId: string,
        status: OrderStatus,
        locale: 'id' | 'en' = 'id',
    ) {
        const statusMessages = this.getOrderStatusMessages(status, orderNumber, locale);

        if (!statusMessages) return null; // Skip if no message for this status

        const notificationType = this.getOrderNotificationType(status);
        if (!notificationType) return null;

        return this.createNotification({
            userId,
            type: notificationType,
            title: statusMessages.title,
            message: statusMessages.message,
            data: { orderId, orderNumber, status },
            actionUrl: `/user/orders/${orderNumber}`,
        });
    }

    private getOrderNotificationType(status: OrderStatus): NotificationType | null {
        const map: Partial<Record<OrderStatus, NotificationType>> = {
            PAID: NotificationType.ORDER_PAID,
            PROCESSING: NotificationType.ORDER_PROCESSING,
            SHIPPED: NotificationType.ORDER_SHIPPED,
            DELIVERED: NotificationType.ORDER_DELIVERED,
            COMPLETED: NotificationType.ORDER_COMPLETED,
            CANCELLED: NotificationType.ORDER_CANCELLED,
            FAILED: NotificationType.ORDER_FAILED,
        };
        return map[status] || null;
    }

    private getOrderStatusMessages(
        status: OrderStatus,
        orderNumber: string,
        locale: 'id' | 'en',
    ): { title: string; message: string } | null {
        const messages: Record<string, Record<OrderStatus, { title: string; message: string } | null>> = {
            id: {
                PENDING: null,
                PAID: {
                    title: 'Pembayaran Berhasil',
                    message: `Pembayaran untuk pesanan ${orderNumber} telah dikonfirmasi. Pesanan Anda sedang diproses.`,
                },
                PROCESSING: {
                    title: 'Pesanan Diproses',
                    message: `Pesanan ${orderNumber} sedang diproses dan akan segera dikirim.`,
                },
                SHIPPED: {
                    title: 'Pesanan Dikirim',
                    message: `Pesanan ${orderNumber} telah dikirim. Lacak pengiriman Anda di halaman pesanan.`,
                },
                DELIVERED: {
                    title: 'Pesanan Tiba',
                    message: `Pesanan ${orderNumber} telah tiba di alamat tujuan. Silakan konfirmasi penerimaan.`,
                },
                COMPLETED: {
                    title: 'Pesanan Selesai',
                    message: `Pesanan ${orderNumber} telah selesai. Terima kasih telah berbelanja!`,
                },
                CANCELLED: {
                    title: 'Pesanan Dibatalkan',
                    message: `Pesanan ${orderNumber} telah dibatalkan. Hubungi kami jika ada pertanyaan.`,
                },
                FAILED: {
                    title: 'Pembayaran Gagal',
                    message: `Pembayaran untuk pesanan ${orderNumber} gagal. Silakan coba lagi.`,
                },
            },
            en: {
                PENDING: null,
                PAID: {
                    title: 'Payment Successful',
                    message: `Payment for order ${orderNumber} has been confirmed. Your order is being processed.`,
                },
                PROCESSING: {
                    title: 'Order Processing',
                    message: `Order ${orderNumber} is being processed and will be shipped soon.`,
                },
                SHIPPED: {
                    title: 'Order Shipped',
                    message: `Order ${orderNumber} has been shipped. Track your delivery on the order page.`,
                },
                DELIVERED: {
                    title: 'Order Delivered',
                    message: `Order ${orderNumber} has been delivered. Please confirm receipt.`,
                },
                COMPLETED: {
                    title: 'Order Completed',
                    message: `Order ${orderNumber} is complete. Thank you for shopping!`,
                },
                CANCELLED: {
                    title: 'Order Cancelled',
                    message: `Order ${orderNumber} has been cancelled. Contact us if you have questions.`,
                },
                FAILED: {
                    title: 'Payment Failed',
                    message: `Payment for order ${orderNumber} failed. Please try again.`,
                },
            },
        };

        return messages[locale]?.[status] || messages['en']?.[status] || null;
    }

    // ==========================================
    // REVIEW NOTIFICATION HELPERS
    // ==========================================

    /**
     * Notify user when admin replies to their review
     */
    async notifyReviewReply(
        userId: string,
        productName: string,
        productSlug: string,
        reviewId: string,
        replierName: string,
        locale: 'id' | 'en' = 'id',
    ) {
        const messages = {
            id: {
                title: 'Balasan Ulasan',
                message: `${replierName} membalas ulasan Anda pada produk "${productName}".`,
            },
            en: {
                title: 'Review Reply',
                message: `${replierName} replied to your review on "${productName}".`,
            },
        };

        return this.createNotification({
            userId,
            type: 'REVIEW_REPLY',
            title: messages[locale].title,
            message: messages[locale].message,
            data: { reviewId, productSlug, productName },
            actionUrl: `/products/${productSlug}#reviews`,
        });
    }

    // ==========================================
    // DISCUSSION NOTIFICATION HELPERS
    // ==========================================

    /**
     * Notify user when someone replies to their discussion
     */
    async notifyDiscussionReply(
        userId: string,
        productName: string,
        productSlug: string,
        discussionId: string,
        replierName: string,
        locale: 'id' | 'en' = 'id',
    ) {
        const messages = {
            id: {
                title: 'Balasan Diskusi',
                message: `${replierName} membalas pertanyaan Anda tentang "${productName}".`,
            },
            en: {
                title: 'Discussion Reply',
                message: `${replierName} replied to your question about "${productName}".`,
            },
        };

        return this.createNotification({
            userId,
            type: 'DISCUSSION_REPLY',
            title: messages[locale].title,
            message: messages[locale].message,
            data: { discussionId, productSlug, productName },
            actionUrl: `/products/${productSlug}#discussion`,
        });
    }

    // ==========================================
    // PROMOTION NOTIFICATION HELPERS
    // ==========================================

    /**
     * Notify all users about a new promotion
     */
    async notifyPromotionStart(
        promotionName: string,
        discount: number,
        promotionId: string,
        locale: 'id' | 'en' = 'id',
    ) {
        // Get all active users
        const users = await this.prisma.user.findMany({
            where: { isActive: true, deletedAt: null },
            select: { id: true },
        });

        if (users.length === 0) return null;

        const discountPercent = Math.round(discount * 100);

        const messages = {
            id: {
                title: '🎉 Promo Baru!',
                message: `Promo "${promotionName}" dimulai! Dapatkan diskon hingga ${discountPercent}%.`,
            },
            en: {
                title: '🎉 New Promotion!',
                message: `"${promotionName}" promotion is live! Get up to ${discountPercent}% off.`,
            },
        };

        return this.createBulkNotifications({
            userIds: users.map((u) => u.id),
            type: 'PROMOTION_START',
            title: messages[locale].title,
            message: messages[locale].message,
            data: { promotionId, promotionName, discount },
            actionUrl: `/search?promotion=${promotionId}`,
        });
    }

    // ==========================================
    // STOCK NOTIFICATION HELPERS
    // ==========================================

    /**
     * Notify admin about low stock
     */
    async notifyLowStock(
        productName: string,
        variantName: string,
        currentStock: number,
        productId: string,
    ) {
        // Get all admins and owners
        const admins = await this.prisma.user.findMany({
            where: {
                role: { in: ['ADMIN', 'OWNER'] },
                isActive: true,
                deletedAt: null,
            },
            select: { id: true },
        });

        if (admins.length === 0) return null;

        return this.createBulkNotifications({
            userIds: admins.map((a) => a.id),
            type: 'STOCK_LOW',
            title: '⚠️ Stok Menipis',
            message: `Stok ${productName} (${variantName}) tinggal ${currentStock} unit.`,
            data: { productId, productName, variantName, currentStock },
            actionUrl: `/admin/products/${productId}/edit`,
        });
    }

    // ==========================================
    // CLEANUP (CRON)
    // ==========================================

    /**
     * Delete old read notifications (older than 30 days)
     */
    async cleanupOldNotifications() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await this.prisma.notification.deleteMany({
            where: {
                isRead: true,
                readAt: { lt: thirtyDaysAgo },
            },
        });

        this.logger.info(`🧹 Cleaned up ${result.count} old notifications`);

        return result;
    }
}