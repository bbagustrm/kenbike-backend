import { z } from 'zod';

export const AddItemSchema = z.object({
    variantId: z.string().uuid('Invalid variant ID'),
    quantity: z
        .number()
        .int('Quantity must be an integer')
        .min(1, 'Quantity must be at least 1')
        .max(100, 'Quantity cannot exceed 100')
        .or(
            z
                .string()
                .transform((val) => parseInt(val, 10))
                .pipe(z.number().int().min(1).max(100)),
        ),
});

export type AddItemDto = z.infer<typeof AddItemSchema>;