import { z } from 'zod';

export const GetAllUsersSchema = z.object({
    page: z
        .string()
        .optional()
        .transform((val) => {
            const num = val ? parseInt(val, 10) : 1;
            return isNaN(num) || num < 1 ? 1 : num;
        }),
    limit: z
        .string()
        .optional()
        .transform((val) => {
            const num = val ? parseInt(val, 10) : 10;
            return isNaN(num) || num < 1 ? 10 : Math.min(num, 100);
        }),
    role: z.enum(['USER', 'ADMIN', 'OWNER']).optional(),
    search: z.string().optional(),
    sort_by: z
        .enum(['created_at', 'email', 'username'])
        .optional()
        .default('created_at'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    includeDeleted: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return false;
            return val === 'true' || val === '1';
        })
        .default(false),
    onlyDeleted: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return false;
            return val === 'true' || val === '1';
        })
        .default(false),
});

export type GetAllUsersDto = z.infer<typeof GetAllUsersSchema>;