import { z } from 'zod';

export const CompleteProfileSchema = z.object({
    phone_number: z
        .string()
        .min(10, 'Phone number must be at least 10 characters')
        .max(20, 'Phone number must be at most 20 characters'),
    country: z
        .string()
        .length(2, 'Country code must be 2 characters'),
    province: z
        .string()
        .min(1, 'Province is required')
        .max(100),
    city: z
        .string()
        .min(1, 'City is required')
        .max(100),
    district: z
        .string()
        .max(100)
        .optional(),
    postal_code: z
        .string()
        .min(1, 'Postal code is required')
        .max(10),
    address: z
        .string()
        .min(10, 'Address must be at least 10 characters')
        .max(500),
});

export type CompleteProfileDto = z.infer<typeof CompleteProfileSchema>;