import { z } from 'zod';

export const CreatePromotionSchema = z
    .object({
        name: z.string().min(3, 'Promotion name must be at least 3 characters').max(100),
        discount: z
            .number()
            .min(0, 'Discount must be at least 0')
            .max(1, 'Discount cannot exceed 1 (100%)'),
        startDate: z.string().datetime('Invalid start date format'),
        endDate: z.string().datetime('Invalid end date format'),
        isActive: z.boolean().optional().default(true),
    })
    .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
        message: 'End date must be after start date',
        path: ['endDate'],
    });

export type CreatePromotionDto = z.infer<typeof CreatePromotionSchema>;