import { z } from 'zod';

export const RegisterSchema = z.object({
    first_name: z
        .string()
        .min(2, 'First name must be at least 2 characters')
        .max(50, 'First name must not exceed 50 characters'),
    last_name: z
        .string()
        .min(2, 'Last name must be at least 2 characters')
        .max(50, 'Last name must not exceed 50 characters'),
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must not exceed 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z
        .string()
        .email('Invalid email format')
        .max(255, 'Email must not exceed 255 characters'),
    phone_number: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
        .optional(),
    country: z
        .string()
        .max(50, 'Country must not exceed 50 characters')
        .default('Indonesia'),
    city: z
        .string()
        .max(100, 'City must not exceed 100 characters')
        .optional(),
    province: z
        .string()
        .max(100, 'Province must not exceed 100 characters')
        .optional(),
    postal_code: z
        .string()
        .max(10, 'Postal code must not exceed 10 characters')
        .regex(/^[0-9]{5}$/, 'Postal code must be 5 digits')
        .optional(),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*]/, 'Password must contain at least one special character (!@#$%^&*)'),
    address: z
        .string()
        .max(500, 'Address must not exceed 500 characters')
        .optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;