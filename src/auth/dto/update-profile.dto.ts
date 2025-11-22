import { z } from 'zod';

export const UpdateProfileSchema = z.object({
    phone_number: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
        .optional(),
    country: z
        .string()
        .max(50, 'Country must not exceed 50 characters')
        .optional(),
    province: z
        .string()
        .max(100, 'Province must not exceed 100 characters')
        .optional(),
    city: z
        .string()
        .max(100, 'City must not exceed 100 characters')
        .optional(),
    district: z
        .string()
        .max(100, 'District must not exceed 100 characters')
        .optional(),
    postal_code: z
        .string()
        .max(10, 'Postal code must not exceed 10 characters')
        .optional(),
    address: z
        .string()
        .max(500, 'Address must not exceed 500 characters')
        .optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;