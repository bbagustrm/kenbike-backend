// src/review/dto/create-review.dto.ts
import { z } from 'zod';

/**
 * Create Review Schema
 * User submits review for a product from completed order
 */
export const CreateReviewSchema = z.object({
    productId: z.string().uuid('Invalid product ID'),
    orderId: z.string().uuid('Invalid order ID'),
    rating: z
        .number()
        .int()
        .min(1, 'Rating must be at least 1')
        .max(5, 'Rating must be at most 5'),
    comment: z
        .string()
        .min(10, 'Comment must be at least 10 characters')
        .max(1000, 'Comment must be at most 1000 characters')
        .optional(),
});

export type CreateReviewDto = z.infer<typeof CreateReviewSchema>;

/**
 * Update Review Schema
 * User can update their own review
 */
export const UpdateReviewSchema = z.object({
    rating: z
        .number()
        .int()
        .min(1, 'Rating must be at least 1')
        .max(5, 'Rating must be at most 5')
        .optional(),
    comment: z
        .string()
        .min(10, 'Comment must be at least 10 characters')
        .max(1000, 'Comment must be at most 1000 characters')
        .optional(),
});

export type UpdateReviewDto = z.infer<typeof UpdateReviewSchema>;