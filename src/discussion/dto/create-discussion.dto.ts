// src/discussion/dto/create-discussion.dto.ts
import { z } from 'zod';

/**
 * Create Discussion (Question) Schema
 * All logged-in users can ask questions
 */
export const CreateDiscussionSchema = z.object({
    productId: z.string().uuid('Invalid product ID'),
    question: z
        .string()
        .min(10, 'Question must be at least 10 characters')
        .max(1000, 'Question must be at most 1000 characters'),
});

export type CreateDiscussionDto = z.infer<typeof CreateDiscussionSchema>;

/**
 * Update Discussion Schema
 */
export const UpdateDiscussionSchema = z.object({
    question: z
        .string()
        .min(10, 'Question must be at least 10 characters')
        .max(1000, 'Question must be at most 1000 characters'),
});

export type UpdateDiscussionDto = z.infer<typeof UpdateDiscussionSchema>;

/**
 * Create Discussion Reply Schema
 * All logged-in users can reply
 */
export const CreateDiscussionReplySchema = z.object({
    content: z
        .string()
        .min(5, 'Reply must be at least 5 characters')
        .max(1000, 'Reply must be at most 1000 characters'),
});

export type CreateDiscussionReplyDto = z.infer<typeof CreateDiscussionReplySchema>;

/**
 * Update Discussion Reply Schema
 */
export const UpdateDiscussionReplySchema = z.object({
    content: z
        .string()
        .min(5, 'Reply must be at least 5 characters')
        .max(1000, 'Reply must be at most 1000 characters'),
});

export type UpdateDiscussionReplyDto = z.infer<typeof UpdateDiscussionReplySchema>;