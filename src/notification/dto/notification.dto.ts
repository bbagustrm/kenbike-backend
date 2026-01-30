// src/notification/dto/notification.dto.ts
import { z } from 'zod';

// Define NotificationType as Zod enum (to avoid Prisma import issues)
export const NotificationTypeEnum = z.enum([
    'ORDER_PAID',
    'ORDER_PROCESSING',
    'ORDER_SHIPPED',
    'ORDER_DELIVERED',
    'ORDER_COMPLETED',
    'ORDER_CANCELLED',
    'ORDER_FAILED',
    'REVIEW_REPLY',
    'DISCUSSION_REPLY',
    'PROMOTION_START',
    'PROMOTION_ENDING',
    'STOCK_LOW',
    'STOCK_AVAILABLE',
]);

export type NotificationTypeDto = z.infer<typeof NotificationTypeEnum>;

// ==========================================
// CREATE NOTIFICATION DTO (Internal use)
// ==========================================

export const CreateNotificationSchema = z.object({
    userId: z.string().uuid(),
    type: NotificationTypeEnum,
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(1000),
    data: z.record(z.string(), z.any()).optional(),
    imageUrl: z.string().url().optional().nullable(),
    actionUrl: z.string().optional().nullable(),
});

export type CreateNotificationDto = z.infer<typeof CreateNotificationSchema>;

// ==========================================
// QUERY NOTIFICATIONS DTO
// ==========================================

export const QueryNotificationsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    isRead: z
        .string()
        .optional()
        .transform((val) => {
            if (val === 'true') return true;
            if (val === 'false') return false;
            return undefined;
        }),
    type: NotificationTypeEnum.optional(),
});

export type QueryNotificationsDto = z.infer<typeof QueryNotificationsSchema>;

// ==========================================
// MARK AS READ DTO
// ==========================================

export const MarkAsReadSchema = z.object({
    notificationIds: z.array(z.string().uuid()).min(1).max(100),
});

export type MarkAsReadDto = z.infer<typeof MarkAsReadSchema>;

// ==========================================
// BULK CREATE NOTIFICATIONS DTO (for promotions)
// ==========================================

export const BulkCreateNotificationSchema = z.object({
    userIds: z.array(z.string().uuid()).min(1),
    type: NotificationTypeEnum,
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(1000),
    data: z.record(z.string(), z.any()).optional(),
    imageUrl: z.string().url().optional().nullable(),
    actionUrl: z.string().optional().nullable(),
});

export type BulkCreateNotificationDto = z.infer<typeof BulkCreateNotificationSchema>;