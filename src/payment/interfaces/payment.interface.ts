// src/payment/interfaces/payment.interface.ts

// ============================================
// PAYMENT TYPES
// ============================================

export interface PaymentResponse {
    success: boolean;
    message: string;
    data: {
        order_number: string;
        payment_method: string;
        payment_url?: string;
        token?: string;
        payment_id?: string;
        expires_at?: Date;
    };
}

export interface PaymentStatusResponse {
    order_number: string;
    payment_status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
    payment_method: string;
    payment_id?: string;
    paid_at?: Date;
    amount: number;
    currency: string;
}

// ============================================
// MIDTRANS TYPES
// ============================================

export interface MidtransSnapRequest {
    transaction_details: {
        order_id: string;
        gross_amount: number;
    };
    customer_details: {
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
    };
    item_details: Array<{
        id: string;
        price: number;
        quantity: number;
        name: string;
    }>;
    shipping_address?: {
        first_name: string;
        last_name: string;
        phone: string;
        address: string;
        city: string;
        postal_code: string;
        country_code: string;
    };
}

export interface MidtransSnapResponse {
    token: string;
    redirect_url: string;
}

export interface MidtransNotification {
    transaction_time: string;
    transaction_status: string;
    transaction_id: string;
    status_message: string;
    status_code: string;
    signature_key: string;
    settlement_time?: string;
    payment_type: string;
    order_id: string;
    merchant_id: string;
    gross_amount: string;
    fraud_status: string;
    currency: string;
}

// ============================================
// PAYPAL TYPES
// ============================================

export interface PayPalOrderRequest {
    intent: 'CAPTURE';
    purchase_units: Array<{
        reference_id: string;
        amount: {
            currency_code: 'USD';
            value: string;
            breakdown?: {
                item_total: {
                    currency_code: 'USD';
                    value: string;
                };
                shipping?: {
                    currency_code: 'USD';
                    value: string;
                };
                tax_total?: {
                    currency_code: 'USD';
                    value: string;
                };
            };
        };
        items?: Array<{
            name: string;
            unit_amount: {
                currency_code: 'USD';
                value: string;
            };
            quantity: string;
        }>;
        shipping?: {
            name: {
                full_name: string;
            };
            address: {
                address_line_1: string;
                admin_area_2: string; // City
                admin_area_1?: string; // State
                postal_code: string;
                country_code: string;
            };
        };
    }>;
    application_context: {
        brand_name: string;
        landing_page: 'NO_PREFERENCE' | 'LOGIN' | 'BILLING';
        user_action: 'PAY_NOW' | 'CONTINUE';
        return_url: string;
        cancel_url: string;
    };
}

export interface PayPalOrderResponse {
    id: string;
    status: string;
    links: Array<{
        href: string;
        rel: string;
        method: string;
    }>;
}

export interface PayPalWebhookEvent {
    id: string;
    event_type: string;
    event_version: string;
    create_time: string;
    resource_type: string;
    resource: {
        id: string;
        status: string;
        amount?: {
            currency_code: string;
            value: string;
        };
        supplementary_data?: {
            related_ids: {
                order_id: string;
            };
        };
    };
}