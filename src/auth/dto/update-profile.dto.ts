import { z } from 'zod';

export const UpdateProfileSchema = z.object({
    phone_number: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
        .optional(),
    address: z
        .string()
        .max(255, 'Address must not exceed 255 characters')
        .optional(),
    country: z
        .string()
        .max(50, 'Country must not exceed 50 characters')
        .optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;