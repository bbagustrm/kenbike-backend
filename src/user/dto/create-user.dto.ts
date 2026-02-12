// src/user/dto/create-user.dto.ts

import { z } from 'zod';
import { Role } from '@prisma/client';
import { SUPPORTED_COUNTRIES } from '../../common/constants/countries';

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
        .optional()
        .nullable(),
    country: z
        .enum(SUPPORTED_COUNTRIES, {
            message: 'Invalid country code. Must be 2-character ISO code (e.g., ID, SG, MY)'
        })
        .default('ID'),
    province: z
        .string()
        .max(100, 'Province must not exceed 100 characters')
        .optional()
        .nullable(),
    city: z
        .string()
        .max(100, 'City must not exceed 100 characters')
        .optional()
        .nullable(),
    district: z
        .string()
        .max(100, 'District must not exceed 100 characters')
        .optional()
        .nullable(),
    postal_code: z
        .string()
        .max(10, 'Postal code must not exceed 10 characters')
        .optional()
        .nullable(),
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
        .optional()
        .nullable(),
    role: z.nativeEnum(Role).default(Role.USER),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;