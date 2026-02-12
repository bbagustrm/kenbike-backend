// src/user/dto/update-user.dto.ts

import { z } from 'zod';
import { SUPPORTED_COUNTRIES } from '../../common/constants/countries';

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
        .optional()
        .nullable(),
    address: z
        .string()
        .max(500, 'Address must not exceed 500 characters')
        .optional()
        .nullable(),
    country: z
        .enum(SUPPORTED_COUNTRIES, {
            message: 'Invalid country code. Must be 2-character ISO code (e.g., ID, SG, MY)'
        })
        .optional(),
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
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;