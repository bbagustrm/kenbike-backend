// src/review/dto/query-review.dto.ts
import { z } from 'zod';

/**
 * Query Reviews Schema
 * For filtering and pagination
 */
export const QueryReviewSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),

    // Filter by rating
    rating: z.coerce.number().int().min(1).max(5).optional(),

    // Sort options
    sortBy: z
        .enum(['createdAt', 'rating'])
        .optional()
        .default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type QueryReviewDto = z.infer<typeof QueryReviewSchema>;

/**
 * Query Reviews by Product Schema
 * For getting reviews on product detail page
 */
export const QueryProductReviewsSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    sortBy: z
        .enum(['createdAt', 'rating'])
        .optional()
        .default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type QueryProductReviewsDto = z.infer<typeof QueryProductReviewsSchema>;

/**
 * Admin Query Reviews Schema
 * For admin dashboard with more filters
 */
export const AdminQueryReviewSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),

    // Filters
    productId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    hasReply: z.coerce.boolean().optional(),

    // Search
    search: z.string().optional(),

    // Sort
    sortBy: z
        .enum(['createdAt', 'rating', 'updatedAt'])
        .optional()
        .default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type AdminQueryReviewDto = z.infer<typeof AdminQueryReviewSchema>;