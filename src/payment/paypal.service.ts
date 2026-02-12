// src/payment/paypal.service.ts

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as paypal from '@paypal/checkout-server-sdk';
import {
    PayPalOrderRequest,
    PayPalOrderResponse,
} from './interfaces/payment.interface';

@Injectable()
export class PayPalService {
    private readonly client: any;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly mode: string;

    constructor(
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.clientId = this.configService.get<string>('PAYPAL_CLIENT_ID') || '';
        this.clientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET') || '';
        this.mode = this.configService.get<string>('PAYPAL_MODE') || 'sandbox';

        if (!this.clientId || !this.clientSecret) {
            this.logger.warn('⚠️  PayPal credentials not configured');
        }

        // Initialize PayPal client
        const environment =
            this.mode === 'production'
                ? new paypal.core.LiveEnvironment(this.clientId, this.clientSecret)
                : new paypal.core.SandboxEnvironment(this.clientId, this.clientSecret);

        this.client = new paypal.core.PayPalHttpClient(environment);
    }

    /**
     * Create PayPal order
     */
    async createOrder(orderData: PayPalOrderRequest): Promise<PayPalOrderResponse> {
        try {
            const request = new paypal.orders.OrdersCreateRequest();
            request.prefer('return=representation');
            request.requestBody(orderData);

            this.logger.info('💳 PayPal: Creating order', {
                referenceId: orderData.purchase_units[0].reference_id,
                amount: orderData.purchase_units[0].amount.value,
            });

            const response = await this.client.execute(request);

            const approveLink = response.result.links.find(
                (link: any) => link.rel === 'approve',
            );

            this.logger.info('✅ PayPal: Order created', {
                orderId: response.result.id,
                status: response.result.status,
            });

            return {
                id: response.result.id,
                status: response.result.status,
                links: response.result.links,
            };
        } catch (error: any) {
            this.logger.error('❌ PayPal: Failed to create order', {
                error: error.message,
                details: error.response?.data,
            });

            throw new BadRequestException(
                'Failed to create PayPal payment. Please try again.',
            );
        }
    }

    /**
     * Capture PayPal payment
     */
    async capturePayment(orderId: string): Promise<any> {
        try {
            const request = new paypal.orders.OrdersCaptureRequest(orderId);
            request.requestBody({});

            this.logger.info('💰 PayPal: Capturing payment', { orderId });

            const response = await this.client.execute(request);

            this.logger.info('✅ PayPal: Payment captured', {
                orderId,
                status: response.result.status,
                captureId: response.result.purchase_units[0].payments.captures[0].id,
            });

            return response.result;
        } catch (error: any) {
            this.logger.error('❌ PayPal: Failed to capture payment', {
                orderId,
                error: error.message,
                details: error.response?.data,
            });

            throw new BadRequestException(
                'Failed to capture PayPal payment. Please try again.',
            );
        }
    }

    /**
     * Get order details
     */
    async getOrderDetails(orderId: string): Promise<any> {
        try {
            const request = new paypal.orders.OrdersGetRequest(orderId);

            this.logger.info('🔍 PayPal: Getting order details', { orderId });

            const response = await this.client.execute(request);

            return response.result;
        } catch (error: any) {
            this.logger.error('❌ PayPal: Failed to get order details', {
                orderId,
                error: error.message,
            });

            throw new BadRequestException('Failed to get PayPal order details');
        }
    }

    /**
     * Verify webhook signature
     * Note: Requires PayPal webhook ID and headers
     */
    async verifyWebhook(headers: any, body: any): Promise<boolean> {
        try {
            // TODO: Implement PayPal webhook verification
            // Requires PayPal webhook ID from dashboard
            // For now, return true (skip verification)

            this.logger.info('⚠️ PayPal: Webhook signature verification skipped');

            return true;
        } catch (error: any) {
            this.logger.error('❌ PayPal: Webhook verification failed', {
                error: error.message,
            });
            return false;
        }
    }

    /**
     * Check if PayPal is configured
     */
    isConfigured(): boolean {
        return !!this.clientId && !!this.clientSecret;
    }
}