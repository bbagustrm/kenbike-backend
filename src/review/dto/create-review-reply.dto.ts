// src/review/dto/create-review-reply.dto.ts
import { z } from 'zod';

/**
 * Create Review Reply Schema
 * Admin/Owner replies to a review
 */
export const CreateReviewReplySchema = z.object({
    content: z
        .string()
        .min(5, 'Reply must be at least 5 characters')
        .max(1000, 'Reply must be at most 1000 characters'),
});

export type CreateReviewReplyDto = z.infer<typeof CreateReviewReplySchema>;

/**
 * Update Review Reply Schema
 */
export const UpdateReviewReplySchema = z.object({
    content: z
        .string()
        .min(5, 'Reply must be at least 5 characters')
        .max(1000, 'Reply must be at most 1000 characters'),
});

export type UpdateReviewReplyDto = z.infer<typeof UpdateReviewReplySchema>;