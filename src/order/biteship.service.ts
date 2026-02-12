// src/order/biteship.service.ts

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import axios, { AxiosInstance } from 'axios';
import {
    BiteshipRatesRequest,
    BiteshipRatesResponse,
    BiteshipOrderRequest,
    BiteshipOrderResponse,
    BiteshipTrackingResponse,
} from './interfaces/shipping.interface';

@Injectable()
export class BiteshipService {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly client: AxiosInstance;
    private readonly availableCouriers: string[];

    constructor(
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.apiKey = this.configService.get<string>('BITESHIP_API_KEY') || '';
        this.baseUrl = this.configService.get<string>('BITESHIP_BASE_URL') || 'https://api.biteship.com/v1';
        this.availableCouriers = (this.configService.get<string>('BITESHIP_COURIERS') || 'jne,tiki,sicepat').split(',');

        if (!this.apiKey) {
            this.logger.warn('⚠️  Biteship API key not configured. Domestic shipping will not work.');
        }

        // Create axios instance with auth header
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': this.apiKey,
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds
        });
    }

    /**
     * Calculate shipping rates for domestic Indonesia
     */
    async getRates(
        destinationPostalCode: string,
        items: Array<{ name: string; value: number; weight: number; quantity: number }>,
        courier?: string,
    ): Promise<BiteshipRatesResponse> {
        try {
            const originPostalCode = this.configService.get<string>('WAREHOUSE_POSTAL_CODE');

            if (!originPostalCode) {
                throw new BadRequestException('Warehouse postal code not configured');
            }

            // Determine which couriers to use
            let couriersToUse: string;

            if (!courier || courier.trim() === '') {
                // If no courier specified, use all configured couriers
                couriersToUse = this.availableCouriers.join(',');
            } else {
                // Use the specified courier(s)
                // Validate that all specified couriers are in available list
                const requestedCouriers = courier.split(',').map(c => c.trim().toLowerCase());
                const validCouriers = requestedCouriers.filter(c =>
                    this.availableCouriers.includes(c)
                );

                if (validCouriers.length === 0) {
                    throw new BadRequestException(
                        `Invalid courier(s). Available: ${this.availableCouriers.join(', ')}`
                    );
                }

                couriersToUse = validCouriers.join(',');
            }

            const requestData: BiteshipRatesRequest = {
                origin_postal_code: originPostalCode,
                destination_postal_code: destinationPostalCode,
                couriers: couriersToUse,
                items,
            };

            this.logger.info('📦 Biteship: Calculating rates', {
                origin: originPostalCode,
                destination: destinationPostalCode,
                couriers: couriersToUse,
                items: items.length,
            });

            const response = await this.client.post<BiteshipRatesResponse>('/rates/couriers', requestData);

            if (!response.data.success) {
                this.logger.error('❌ Biteship API returned error', {
                    message: response.data.message,
                    data: response.data,
                });
                throw new BadRequestException(response.data.message || 'Failed to get shipping rates from Biteship');
            }

            this.logger.info(`✅ Biteship: Found ${response.data.pricing.length} shipping options`);

            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Biteship: Failed to get rates', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });

            // Handle specific Biteship API errors
            if (error.response?.status === 400) {
                const biteshipError = error.response.data;

                // Log the full Biteship error for debugging
                this.logger.error('🔍 Biteship API Error Details:', {
                    message: biteshipError.message,
                    error: biteshipError.error,
                    code: biteshipError.code,
                });

                // Return more specific error messages
                if (biteshipError.error?.includes('postal')) {
                    throw new BadRequestException(
                        `Invalid postal code. Origin: ${this.configService.get('WAREHOUSE_POSTAL_CODE')}, ` +
                        `Destination: ${error.config?.data ? JSON.parse(error.config.data).destination_postal_code : 'unknown'}. ` +
                        `Biteship message: ${biteshipError.message || biteshipError.error}`
                    );
                }

                throw new BadRequestException(
                    biteshipError.message || biteshipError.error || 'Invalid shipping information. Please check your address and postal code.'
                );
            }

            if (error.response?.status === 401) {
                throw new BadRequestException('Biteship authentication failed. Please contact support.');
            }

            // If it's already a BadRequestException, rethrow it
            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException('Failed to calculate shipping rates. Please try again or contact support.');
        }
    }

    /**
     * Create shipping order with Biteship
     */
    async createOrder(orderData: BiteshipOrderRequest): Promise<BiteshipOrderResponse> {
        try {
            this.logger.info('📦 Biteship: Creating shipping order', {
                courier: orderData.courier_company,
                type: orderData.courier_type,
                destination: orderData.destination_postal_code,
            });

            const response = await this.client.post<BiteshipOrderResponse>('/orders', orderData);

            if (!response.data.success) {
                throw new BadRequestException(response.data.message || 'Failed to create shipping order');
            }

            this.logger.info(`✅ Biteship: Order created`, {
                orderId: response.data.id,
                trackingId: response.data.courier.tracking_id,
            });

            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Biteship: Failed to create order', {
                error: error.message,
                response: error.response?.data,
            });

            if (error.response?.status === 400) {
                throw new BadRequestException(
                    error.response.data?.message || 'Invalid shipping order data.',
                );
            }

            throw new BadRequestException('Failed to create shipping order. Please try again.');
        }
    }

    /**
     * Track shipment
     */
    async trackShipment(biteshipOrderId: string): Promise<BiteshipTrackingResponse> {
        try {
            this.logger.info('📦 Biteship: Tracking shipment', { orderId: biteshipOrderId });

            const response = await this.client.get<BiteshipTrackingResponse>(
                `/trackings/${biteshipOrderId}`,
            );

            if (!response.data.success) {
                throw new BadRequestException(response.data.message || 'Failed to track shipment');
            }

            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Biteship: Failed to track shipment', {
                orderId: biteshipOrderId,
                error: error.message,
                response: error.response?.data,
            });

            if (error.response?.status === 404) {
                throw new BadRequestException('Shipment not found');
            }

            throw new BadRequestException('Failed to track shipment. Please try again.');
        }
    }

    /**
     * Get shipping label URL
     * Fixed: Better error handling and correct URL format
     */
    async getShippingLabel(biteshipOrderId: string): Promise<string> {
        try {
            this.logger.info('📄 Biteship: Getting shipping label', { orderId: biteshipOrderId });

            // Get order detail first
            const response = await this.client.get<any>(
                `/orders/${biteshipOrderId}`,
            );

            if (!response.data.success) {
                throw new BadRequestException(
                    response.data.message || 'Failed to get order details'
                );
            }

            const orderData = response.data;

            // Try multiple sources for label URL
            let labelUrl: string | null = null;

            // 1. Check courier.link (most reliable)
            if (orderData.courier?.link) {
                labelUrl = orderData.courier.link;
            }

            // 2. Check if waybill_id exists, construct PDF URL
            else if (orderData.courier?.waybill_id) {
                labelUrl = `https://biteship.com/labels/${orderData.courier.waybill_id}.pdf`;
            }

            // 3. Fallback to tracking_id
            else if (orderData.courier?.tracking_id) {
                labelUrl = `https://biteship.com/labels/${orderData.courier.tracking_id}.pdf`;
            }

            if (!labelUrl) {
                this.logger.warn('⚠️ Shipping label not available yet', {
                    orderId: biteshipOrderId,
                    orderStatus: orderData.status,
                });

                throw new BadRequestException(
                    'Shipping label is not available yet. Please wait a few minutes after shipping and try again.'
                );
            }


            this.logger.info('✅ Biteship: Shipping label URL retrieved', { labelUrl });

            return labelUrl;
        } catch (error: any) {
            this.logger.error('❌ Biteship: Failed to get shipping label', {
                orderId: biteshipOrderId,
                error: error.message,
                response: error.response?.data,
            });

            if (error.response?.status === 404) {
                throw new BadRequestException('Order not found in Biteship');
            }

            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException('Failed to retrieve shipping label. Please try again later.');
        }
    }

    /**
     * Check if Biteship is properly configured
     */
    isConfigured(): boolean {
        return !!this.apiKey && !!this.configService.get<string>('WAREHOUSE_POSTAL_CODE');
    }

    /**
     * Get available couriers list
     */
    getAvailableCouriers(): string[] {
        return this.availableCouriers;
    }
}