import { z } from 'zod';

export const ChangeStatusSchema = z.object({
    is_active: z
        .boolean()
        .refine((val) => typeof val === 'boolean', {
            message: 'is_active must be a boolean',
            path: ['is_active'],
        }),
    reason: z.string().optional(),
});

export type ChangeStatusDto = z.infer<typeof ChangeStatusSchema>;