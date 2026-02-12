import { z } from 'zod';

export const GetCategoriesSchema = z.object({
    page: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1))
        .pipe(z.number().min(1)),
    limit: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 20))
        .pipe(z.number().min(1).max(100)),
    search: z.string().optional(),
    isActive: z
        .string()
        .optional()
        .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
    sortBy: z.enum(['name', 'productCount', 'createdAt']).optional().default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    includeDeleted: z
        .string()
        .optional()
        .transform((val) => val === 'true'),
});

export type GetCategoriesDto = z.infer<typeof GetCategoriesSchema>;