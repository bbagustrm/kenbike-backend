import { z } from 'zod';

export const UpdateTagSchema = z.object({
    name: z.string().min(2).max(50).optional(),
    slug: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-]+$/)
        .optional(),
    isActive: z.boolean().optional(),
});

export type UpdateTagDto = z.infer<typeof UpdateTagSchema>;