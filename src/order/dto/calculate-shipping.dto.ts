import { z } from 'zod';

/**
 * DTO for calculating shipping costs
 */
export const CalculateShippingSchema = z.object({
    // Destination
    country: z.string().min(2).max(2).toUpperCase(), // Country code (ID, US, SG, etc.)
    province: z.string().optional(), // Required for domestic (Indonesia)
    city: z.string().min(1),
    district: z.string().optional(), // Kecamatan (for domestic)
    postal_code: z.string().min(1).max(10),
    address: z.string().min(10).max(500),

    // Weight (in grams)
    total_weight: z.number().int().min(1).max(30000), // Max 30kg

    // Courier preference (for domestic)
    courier: z.enum(['jne', 'tiki', 'sicepat', 'jnt', 'pos', 'anteraja', 'all']).optional(),
});

export type CalculateShippingDto = z.infer<typeof CalculateShippingSchema>;

/**
 * Response type for shipping calculation
 */
export interface ShippingOption {
    type: 'DOMESTIC' | 'INTERNATIONAL';
    courier?: string; // For domestic: "jne", "tiki", etc.
    service?: string; // For domestic: "reg", "yes", etc.
    serviceName: string; // Display name: "JNE REG", "Zone 1 - Southeast Asia"
    description?: string;
    cost: number;
    estimatedDays: {
        min: number;
        max: number;
    };
    // Biteship specific (for domestic)
    biteshipPriceId?: string;
    insurance?: {
        required: boolean;
        fee: number;
    };
    // Zone specific (for international)
    zoneId?: string;
    zoneName?: string;
}

export interface CalculateShippingResponse {
    destination: {
        country: string;
        city: string;
        postalCode: string;
    };
    totalWeight: number; // in grams
    shippingType: 'DOMESTIC' | 'INTERNATIONAL';
    options: ShippingOption[];
}