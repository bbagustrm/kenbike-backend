// ============================================
// BITESHIP TYPES
// ============================================

export interface BiteshipRatesRequest {
    origin_postal_code: string;
    destination_postal_code: string;
    couriers: string; // "jne,tiki,sicepat"
    items: Array<{
        name: string;
        value: number;
        weight: number; // in grams
        quantity: number;
    }>;
}

export interface BiteshipRatesResponse {
    success: boolean;
    message?: string;
    origin: {
        postal_code: string;
        latitude: number;
        longitude: number;
    };
    destination: {
        postal_code: string;
        latitude: number;
        longitude: number;
    };
    pricing: Array<{
        available_collection_method: string[];
        available_for_cash_on_delivery: boolean;
        available_for_proof_of_delivery: boolean;
        available_for_instant_waybill_id: boolean;
        available_for_insurance: boolean;
        company: string;
        courier_name: string;
        courier_code: string;
        courier_service_name: string;
        description: string;
        duration: string;
        shipment_duration_range: string; // "2 - 3"
        shipment_duration_unit: string;
        service_type: string;
        shipping_type: string;
        price: number;
        type: string; // "reg", "yes", etc.
    }>;
}

/**
 * ✅ NEW: Biteship Create Order Request
 */
export interface BiteshipOrderRequest {
    // Origin (warehouse/store)
    origin_contact_name: string;
    origin_contact_phone: string;
    origin_address: string;
    origin_postal_code: string;
    origin_note?: string;

    // Destination (customer)
    destination_contact_name: string;
    destination_contact_phone: string;
    destination_contact_email?: string;
    destination_address: string;
    destination_postal_code: string;
    destination_note?: string;

    // Courier selection
    courier_company: string; // "jne", "tiki", etc.
    courier_type: string; // "reg", "yes", etc.

    // Delivery settings
    delivery_type: 'now' | 'scheduled';
    delivery_date?: string; // ISO date if scheduled
    delivery_time?: string; // Time if scheduled

    // Order details
    order_note?: string;
    items: Array<{
        name: string;
        description?: string;
        value: number;
        quantity: number;
        weight: number; // in grams
        height?: number; // in cm
        length?: number; // in cm
        width?: number; // in cm
    }>;
}

/**
 * ✅ NEW: Biteship Create Order Response
 */
export interface BiteshipOrderResponse {
    success: boolean;
    message?: string;
    id: string; // Biteship order ID
    courier: {
        tracking_id: string; // AWB/tracking number
        waybill_id: string;
        company: string;
        name: string;
        phone: string;
        type: string;
        link?: string; // Tracking link
    };
    origin: {
        contact_name: string;
        contact_phone: string;
        address: string;
        postal_code: string;
    };
    destination: {
        contact_name: string;
        contact_phone: string;
        contact_email?: string;
        address: string;
        postal_code: string;
    };
    delivery: {
        type: string;
        datetime?: string;
        note?: string;
    };
    price: number;
    status: string;
}

/**
 * ✅ NEW: Biteship Tracking Response
 */
export interface BiteshipTrackingResponse {
    success: boolean;
    message?: string;
    courier: {
        company: string;
        name: string;
        tracking_id: string;
        waybill_id: string;
    };
    status: string; // "confirmed", "picked", "in_transit", "delivered", etc.
    history: Array<{
        status: string;
        note: string;
        updated_at: string; // ISO datetime
        service_type?: string;
    }>;
    link: string; // Public tracking URL
    order_id: string;
}

// ============================================
// INTERNATIONAL SHIPPING TYPES
// ============================================

export interface InternationalShippingZone {
    id: string;
    name: string;
    countries: string[]; // Array of country codes
    baseRate: number;
    perKgRate: number;
    minDays: number;
    maxDays: number;
}