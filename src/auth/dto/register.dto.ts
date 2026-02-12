// src/auth/dto/register.dto.ts

import { z } from 'zod';

// ✅ FIXED: Remove 'as const' and use different approach for enum
const SUPPORTED_COUNTRIES = [
    // Domestic
    'ID', // Indonesia

    // Zone 1 - Southeast Asia
    'SG', // Singapore
    'MY', // Malaysia
    'TH', // Thailand
    'PH', // Philippines
    'VN', // Vietnam
    'BN', // Brunei
    'KH', // Cambodia
    'LA', // Laos
    'MM', // Myanmar
    'TL', // Timor-Leste

    // Zone 2 - East Asia
    'CN', // China
    'HK', // Hong Kong
    'TW', // Taiwan
    'KR', // South Korea
    'JP', // Japan
    'MO', // Macau

    // Zone 3 - South Asia & Middle East
    'IN', // India
    'PK', // Pakistan
    'BD', // Bangladesh
    'LK', // Sri Lanka
    'NP', // Nepal
    'BT', // Bhutan
    'MV', // Maldives
    'AE', // United Arab Emirates
    'SA', // Saudi Arabia
    'KW', // Kuwait
    'QA', // Qatar
    'BH', // Bahrain
    'OM', // Oman
    'JO', // Jordan
    'IL', // Israel
    'LB', // Lebanon

    // Zone 4 - Oceania
    'AU', // Australia
    'NZ', // New Zealand
    'PG', // Papua New Guinea
    'FJ', // Fiji
    'NC', // New Caledonia
    'PF', // French Polynesia
    'WS', // Samoa
    'TO', // Tonga
    'VU', // Vanuatu

    // Zone 5 - Europe
    'GB', // United Kingdom
    'FR', // France
    'DE', // Germany
    'IT', // Italy
    'ES', // Spain
    'NL', // Netherlands
    'BE', // Belgium
    'CH', // Switzerland
    'AT', // Austria
    'SE', // Sweden
    'NO', // Norway
    'DK', // Denmark
    'FI', // Finland
    'PL', // Poland
    'CZ', // Czech Republic
    'PT', // Portugal
    'GR', // Greece
    'IE', // Ireland
    'RO', // Romania
    'HU', // Hungary

    // Zone 6 - Americas
    'US', // United States
    'CA', // Canada
    'MX', // Mexico
    'BR', // Brazil
    'AR', // Argentina
    'CL', // Chile
    'CO', // Colombia
    'PE', // Peru
    'VE', // Venezuela
    'CR', // Costa Rica
    'PA', // Panama

    // Zone 7 - Africa
    'ZA', // South Africa
    'EG', // Egypt
    'NG', // Nigeria
    'KE', // Kenya
    'MA', // Morocco
    'GH', // Ghana
    'TZ', // Tanzania
    'UG', // Uganda
    'ET', // Ethiopia
    'DZ', // Algeria
] as const;

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
    country: z.enum(SUPPORTED_COUNTRIES, {
        message: 'Invalid country code. Must be 2-character ISO code (e.g., ID, SG, MY)'
    }).default('ID'),
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