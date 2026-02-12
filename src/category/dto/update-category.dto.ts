import { z } from 'zod';

export const UpdateCategorySchema = z.object({
    name: z.string().min(2).max(100).optional(),
    slug: z
        .string()
        .min(2)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .optional(),
    isActive: z.boolean().optional(),
});

export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;