import { z } from 'zod';

export const CreateTagSchema = z.object({
    name: z.string().min(2, 'Tag name must be at least 2 characters').max(50),
    slug: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only'),
});

export type CreateTagDto = z.infer<typeof CreateTagSchema>;