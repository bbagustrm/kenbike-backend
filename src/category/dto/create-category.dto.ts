import { z } from 'zod';

export const CreateCategorySchema = z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters').max(100),
    slug: z
        .string()
        .min(2)
        .max(100)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only'),
});

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;