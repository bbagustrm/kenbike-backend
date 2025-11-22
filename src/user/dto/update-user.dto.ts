import { z } from 'zod';

export const UpdateUserSchema = z.object({
    first_name: z
        .string()
        .min(2, 'First name must be at least 2 characters')
        .max(50, 'First name must not exceed 50 characters')
        .optional(),
    last_name: z
        .string()
        .min(2, 'Last name must be at least 2 characters')
        .max(50, 'Last name must not exceed 50 characters')
        .optional(),
    email: z
        .string()
        .email('Invalid email format')
        .max(255, 'Email must not exceed 255 characters')
        .optional(),
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
    province: z
        .string()
        .max(100)
        .optional(),
    city: z
        .string()
        .max(100)
        .optional(),
    district: z
        .string()
        .max(100)
        .optional(),
    postal_code: z
        .string()
        .max(10)
        .optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;