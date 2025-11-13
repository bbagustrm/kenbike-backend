// src/payment/dto/payment.dto.ts

import { z } from 'zod';

/**
 * DTO for creating payment
 */
export const CreatePaymentSchema = z.object({
    order_number: z.string().min(1, 'Order number is required'),
    payment_method: z.enum(['MIDTRANS_SNAP', 'PAYPAL'], {
        message: 'Payment method must be MIDTRANS_SNAP or PAYPAL',
    }),
});

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;

/**
 * DTO for getting payment status
 */
export const GetPaymentStatusSchema = z.object({
    order_number: z.string().min(1, 'Order number is required'),
});

export type GetPaymentStatusDto = z.infer<typeof GetPaymentStatusSchema>;

/**
 * DTO for PayPal capture payment
 */
export const CapturePayPalPaymentSchema = z.object({
    order_number: z.string().min(1, 'Order number is required'),
    paypal_order_id: z.string().min(1, 'PayPal order ID is required'),
});

export type CapturePayPalPaymentDto = z.infer<typeof CapturePayPalPaymentSchema>;

/**
 * DTO for Midtrans webhook notification
 */
export const MidtransWebhookSchema = z.object({
    transaction_time: z.string(),
    transaction_status: z.string(),
    transaction_id: z.string(),
    status_message: z.string(),
    status_code: z.string(),
    signature_key: z.string(),
    settlement_time: z.string().optional(),
    payment_type: z.string(),
    order_id: z.string(),
    merchant_id: z.string(),
    gross_amount: z.string(),
    fraud_status: z.string(),
    currency: z.string(),
});

export type MidtransWebhookDto = z.infer<typeof MidtransWebhookSchema>;