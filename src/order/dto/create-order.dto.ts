import { z } from 'zod';

/**
 * DTO for creating order from cart
 */
export const CreateOrderSchema = z.object({
    // Shipping destination
    recipient_name: z.string().min(2).max(100),
    recipient_phone: z.string().min(10).max(20),
    shipping_address: z.string().min(10).max(500),
    shipping_city: z.string().min(2).max(100),
    shipping_province: z.string().optional(), // Required for domestic
    shipping_country: z.string().length(2).toUpperCase(), // Country code
    shipping_postal_code: z.string().min(3).max(10),
    shipping_notes: z.string().max(500).optional(),

    // Shipping method selection
    shipping_type: z.enum(['DOMESTIC', 'INTERNATIONAL']),

    // For DOMESTIC shipping (Biteship)
    biteship_courier: z.string().optional(), // "jne", "tiki", etc.
    biteship_service: z.string().optional(), // "reg", "yes", etc.
    biteship_price_id: z.string().optional(), // From Biteship rates response

    // For INTERNATIONAL shipping
    shipping_zone_id: z.string().uuid().optional(),

    // Payment method (for now, just store, actual payment in Phase 3)
    payment_method: z.enum(['MIDTRANS_SNAP', 'PAYPAL', 'MANUAL']).optional(),

    // Currency (default IDR)
    currency: z.enum(['IDR', 'USD']).default('IDR'),
}).refine(
    (data) => {
        // If DOMESTIC, require Biteship fields
        if (data.shipping_type === 'DOMESTIC') {
            return (
                data.biteship_courier &&
                data.biteship_service &&
                data.biteship_price_id &&
                data.shipping_province
            );
        }
        // If INTERNATIONAL, require zone
        if (data.shipping_type === 'INTERNATIONAL') {
            return data.shipping_zone_id;
        }
        return true;
    },
    {
        message: 'Invalid shipping configuration',
    }
);

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

/**
 * Response type for order creation
 */
export interface CreateOrderResponse {
    message: string;
    data: {
        id: string;
        orderNumber: string;
        status: string;
        subtotal: number;
        discount: number;
        tax: number;
        shippingCost: number;
        total: number;
        currency: string;
        items: Array<{
            productName: string;
            variantName: string;
            quantity: number;
            pricePerItem: number;
            subtotal: number;
        }>;
        shipping: {
            type: string;
            method: string;
            recipientName: string;
            recipientPhone: string;
            address: string;
            city: string;
            country: string;
            postalCode: string;
        };
        paymentMethod?: string;
        createdAt: Date;
    };
}