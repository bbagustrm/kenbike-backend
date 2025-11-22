import { z } from 'zod';
import { Role } from '@prisma/client';

export const CreateUserSchema = z.object({
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
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*]/, 'Password must contain at least one special character (!@#$%^&*)'),
    address: z
        .string()
        .max(255, 'Address must not exceed 255 characters')
        .optional(),
    role: z.nativeEnum(Role).default(Role.USER),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;