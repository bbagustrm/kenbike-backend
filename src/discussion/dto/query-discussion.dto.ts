// src/discussion/dto/query-discussion.dto.ts
import { z } from 'zod';

/**
 * Query Discussions by Product Schema
 * For getting Q&A on product detail page
 */
export const QueryProductDiscussionsSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),

    // Sort options
    sortBy: z
        .enum(['createdAt', 'likesCount'])
        .optional()
        .default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type QueryProductDiscussionsDto = z.infer<typeof QueryProductDiscussionsSchema>;

/**
 * Admin Query Discussions Schema
 * For admin dashboard with more filters
 */
export const AdminQueryDiscussionSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),

    // Filters
    productId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    hasReplies: z.coerce.boolean().optional(),

    // Search
    search: z.string().optional(),

    // Sort
    sortBy: z
        .enum(['createdAt', 'likesCount', 'updatedAt'])
        .optional()
        .default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type AdminQueryDiscussionDto = z.infer<typeof AdminQueryDiscussionSchema>;