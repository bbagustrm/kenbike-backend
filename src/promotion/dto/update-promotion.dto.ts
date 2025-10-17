import { z } from 'zod';

export const UpdatePromotionSchema = z
    .object({
        name: z.string().min(3).max(100).optional(),
        discount: z.number().min(0).max(1).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        isActive: z.boolean().optional(),
    })
    .refine(
        (data) => {
            if (data.startDate && data.endDate) {
                return new Date(data.endDate) > new Date(data.startDate);
            }
            return true;
        },
        {
            message: 'End date must be after start date',
            path: ['endDate'],
        },
    );

export type UpdatePromotionDto = z.infer<typeof UpdatePromotionSchema>;