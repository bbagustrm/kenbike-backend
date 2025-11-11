/**
 * Biteship API Response Interfaces
 * Documentation: https://biteship.com/docs
 */

export interface BiteshipRatesRequest {
    origin_postal_code: string;
    destination_postal_code: string;
    destination_area_id?: string; // Optional, for more accurate rates
    couriers: string; // Comma-separated: "jne,tiki,sicepat"
    items: Array<{
        name: string;
        value: number;
        weight: number; // in grams
        quantity: number;
    }>;
}

export interface BiteshipRateOption {
    available_for_cash_on_delivery: boolean;
    available_for_proof_of_delivery: boolean;
    available_for_instant_waybill_id: boolean;
    available_for_insurance: boolean;
    company: string; // "jne"
    courier_name: string; // "JNE"
    courier_code: string; // "jne"
    courier_service_name: string; // "Reguler"
    courier_service_code: string; // "reg"
    description: string;
    duration: string; // "2 - 3 hari"
    shipment_duration_range: string; // "2 - 3"
    shipment_duration_unit: string; // "days"
    service_type: string;
    shipping_type: string;
    price: number;
    type: string; // "reg"
}

export interface BiteshipRatesResponse {
    success: boolean;
    message: string;
    object: string; // "rates"
    origin: {
        location_id: string;
        postal_code: number;
        latitude: number;
        longitude: number;
    };
    destination: {
        location_id: string;
        postal_code: number;
        latitude: number;
        longitude: number;
    };
    pricing: BiteshipRateOption[];
}

export interface BiteshipOrderRequest {
    origin_contact_name: string;
    origin_contact_phone: string;
    origin_address: string;
    origin_note?: string;
    origin_postal_code: number;
    destination_contact_name: string;
    destination_contact_phone: string;
    destination_address: string;
    destination_note?: string;
    destination_postal_code: number;
    courier_company: string; // "jne"
    courier_type: string; // "reg"
    courier_insurance?: number; // Optional insurance value
    delivery_type: string; // "now" or scheduled
    delivery_date?: string; // ISO date for scheduled
    delivery_time?: string; // Time for scheduled
    order_note?: string;
    items: Array<{
        id?: string;
        name: string;
        description?: string;
        value: number;
        quantity: number;
        height?: number; // cm
        length?: number; // cm
        weight: number; // grams
        width?: number; // cm
    }>;
}

export interface BiteshipOrderResponse {
    success: boolean;
    message: string;
    object: string; // "order"
    id: string; // Biteship order ID
    shipper: {
        name: string;
        email: string;
        phone: string;
    };
    origin: {
        contact_name: string;
        contact_phone: string;
        address: string;
        note: string;
        postal_code: number;
    };
    destination: {
        contact_name: string;
        contact_phone: string;
        address: string;
        note: string;
        postal_code: number;
    };
    courier: {
        company: string;
        type: string;
        name: string;
        phone: string;
        tracking_id: string; // AWB/Tracking number
        link: string; // Tracking URL
    };
    delivery: {
        type: string;
        datetime: string;
        note: string;
    };
    reference_id?: string; // Our order number
    items: Array<{
        id: string;
        name: string;
        description: string;
        value: number;
        quantity: number;
        weight: number;
    }>;
    price: number;
    status: string;
}

export interface BiteshipTrackingResponse {
    success: boolean;
    message: string;
    object: string; // "tracking"
    id: string;
    status: string;
    order_id: string;
    waybill_id: string;
    courier: {
        company: string;
        name: string;
        phone: string;
    };
    origin: {
        contact_name: string;
        address: string;
    };
    destination: {
        contact_name: string;
        address: string;
    };
    history: Array<{
        note: string;
        updated_at: string;
        status: string;
    }>;
    link: string;
    order_price: number;
    note: string;
}

/**
 * International Shipping Zone Interface
 */
export interface InternationalShippingZone {
    id: string;
    name: string;
    countries: string[];
    baseRate: number;
    perKgRate: number;
    minDays: number;
    maxDays: number;
}

/**
 * Shipping Calculation Result
 */
export interface ShippingCalculation {
    type: 'DOMESTIC' | 'INTERNATIONAL';
    cost: number;
    estimatedDays: {
        min: number;
        max: number;
    };
    serviceName: string;
    // For domestic
    courier?: string;
    service?: string;
    biteshipData?: BiteshipRateOption;
    // For international
    zone?: InternationalShippingZone;
}