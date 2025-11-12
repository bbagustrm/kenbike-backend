import { z } from 'zod';

/**
 * DTO for getting user orders
 */
export const GetOrdersSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(10),
    status: z.enum([
        'PENDING',
        'PAID',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED',
        'FAILED',
    ]).optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'total']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional(), // Search by order number
});

export type GetOrdersDto = z.infer<typeof GetOrdersSchema>;

/**
 * DTO for admin to get all orders
 */
export const GetAllOrdersSchema = GetOrdersSchema.extend({
    user_id: z.string().uuid().optional(), // Filter by user
    payment_method: z.enum(['MIDTRANS_SNAP', 'PAYPAL', 'MANUAL']).optional(),
    shipping_type: z.enum(['DOMESTIC', 'INTERNATIONAL']).optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
});

export type GetAllOrdersDto = z.infer<typeof GetAllOrdersSchema>;

/**
 * DTO for canceling order
 */
export const CancelOrderSchema = z.object({
    reason: z.string().min(10).max(500).optional(),
});

export type CancelOrderDto = z.infer<typeof CancelOrderSchema>;

/**
 * DTO for updating order status (Admin)
 */
export const UpdateOrderStatusSchema = z.object({
    status: z.enum(['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED']),
    tracking_number: z.string().optional(), // Required when status = SHIPPED
    notes: z.string().max(500).optional(),
}).refine(
    (data) => {
        // If status is SHIPPED, tracking number is required
        if (data.status === 'SHIPPED') {
            return !!data.tracking_number;
        }
        return true;
    },
    {
        message: 'Tracking number is required when status is SHIPPED',
        path: ['tracking_number'],
    }
);

export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;