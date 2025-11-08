import { z } from 'zod';

export const UpdateQuantitySchema = z.object({
    quantity: z
        .number()
        .int('Quantity must be an integer')
        .min(0, 'Quantity cannot be negative')
        .max(100, 'Quantity cannot exceed 100')
        .or(
            z
                .string()
                .transform((val) => parseInt(val, 10))
                .pipe(z.number().int().min(0).max(100)),
        ),
});

export type UpdateQuantityDto = z.infer<typeof UpdateQuantitySchema>;