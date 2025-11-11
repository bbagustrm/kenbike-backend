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

            const requestData: BiteshipRatesRequest = {
                origin_postal_code: originPostalCode,
                destination_postal_code: destinationPostalCode,
                couriers: courier || this.availableCouriers.join(','),
                items,
            };

            this.logger.info('📦 Biteship: Calculating rates', {
                origin: originPostalCode,
                destination: destinationPostalCode,
                couriers: requestData.couriers,
            });

            const response = await this.client.post<BiteshipRatesResponse>('/rates/couriers', requestData);

            if (!response.data.success) {
                throw new BadRequestException(response.data.message || 'Failed to get shipping rates');
            }

            this.logger.info(`✅ Biteship: Found ${response.data.pricing.length} shipping options`);

            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Biteship: Failed to get rates', {
                error: error.message,
                response: error.response?.data,
            });

            if (error.response?.status === 400) {
                throw new BadRequestException(
                    error.response.data?.message || 'Invalid shipping information. Please check postal code and address.',
                );
            }

            throw new BadRequestException('Failed to calculate shipping rates. Please try again.');
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
     * Check if Biteship is properly configured
     */
    isConfigured(): boolean {
        return !!this.apiKey && !!this.configService.get<string>('WAREHOUSE_POSTAL_CODE');
    }
}