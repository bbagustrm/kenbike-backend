import { z } from 'zod';

export const GetProductsSchema = z.object({
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
    categoryId: z.string().uuid().optional(),
    categorySlug: z.string().optional(),
    tagId: z.string().uuid().optional(),
    tagSlug: z.string().optional(),
    minPrice: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number().min(0).optional()),
    maxPrice: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined))
        .pipe(z.number().min(0).optional()),
    isFeatured: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            if (val === 'true') return true;
            if (val === 'false') return false;
            return undefined;
        }),
    isPreOrder: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            if (val === 'true') return true;
            if (val === 'false') return false;
            return undefined;
        }),
    hasPromotion: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            if (val === 'true') return true;
            if (val === 'false') return false;
            return undefined;
        }),
    sortBy: z
        .enum(['name', 'idPrice', 'enPrice', 'totalSold', 'totalView', 'avgRating', 'createdAt'])
        .optional()
        .default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    includeDeleted: z
        .string()
        .optional()
        .transform((val) => val === 'true'),
    isActive: z
        .string()
        .optional()
        .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
});

export type GetProductsDto = z.infer<typeof GetProductsSchema>;