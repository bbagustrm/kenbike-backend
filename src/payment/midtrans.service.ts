// src/payment/midtrans.service.ts

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as midtransClient from 'midtrans-client';
import * as crypto from 'crypto';
import {
    MidtransSnapRequest,
    MidtransSnapResponse,
    MidtransNotification,
} from './interfaces/payment.interface';

@Injectable()
export class MidtransService {
    private readonly snap: any;
    private readonly serverKey: string;
    private readonly isProduction: boolean;

    constructor(
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY') || '';
        const clientKey = this.configService.get<string>('MIDTRANS_CLIENT_KEY') || '';
        this.isProduction = this.configService.get<string>('MIDTRANS_IS_PRODUCTION') === 'true';

        if (!this.serverKey || !clientKey) {
            this.logger.warn('⚠️  Midtrans credentials not configured');
        }

        // Initialize Midtrans Snap
        this.snap = new midtransClient.Snap({
            isProduction: this.isProduction,
            serverKey: this.serverKey,
            clientKey: clientKey,
        });
    }

    /**
     * Create Snap token for payment
     */
    async createSnapToken(orderData: MidtransSnapRequest): Promise<MidtransSnapResponse> {
        try {
            this.logger.info('💳 Midtrans: Creating Snap token', {
                orderId: orderData.transaction_details.order_id,
                amount: orderData.transaction_details.gross_amount,
            });

            const transaction = await this.snap.createTransaction(orderData);

            this.logger.info('✅ Midtrans: Snap token created', {
                orderId: orderData.transaction_details.order_id,
                token: transaction.token,
            });

            return {
                token: transaction.token,
                redirect_url: transaction.redirect_url,
            };
        } catch (error: any) {
            this.logger.error('❌ Midtrans: Failed to create Snap token', {
                error: error.message,
                response: error.response?.data,
            });

            throw new BadRequestException(
                error.message || 'Failed to create payment. Please try again.',
            );
        }
    }

    /**
     * Get transaction status from Midtrans
     */
    async getTransactionStatus(orderId: string): Promise<any> {
        try {
            this.logger.info('🔍 Midtrans: Getting transaction status', { orderId });

            const response = await this.snap.transaction.status(orderId);

            this.logger.info('✅ Midtrans: Transaction status retrieved', {
                orderId,
                status: response.transaction_status,
            });

            return response;
        } catch (error: any) {
            this.logger.error('❌ Midtrans: Failed to get transaction status', {
                orderId,
                error: error.message,
            });

            throw new BadRequestException('Failed to get payment status');
        }
    }

    /**
     * Verify webhook notification signature
     */
    verifySignature(notification: MidtransNotification): boolean {
        try {
            const { order_id, status_code, gross_amount, signature_key } = notification;

            // Create signature hash
            const hash = crypto
                .createHash('sha512')
                .update(`${order_id}${status_code}${gross_amount}${this.serverKey}`)
                .digest('hex');

            const isValid = hash === signature_key;

            if (!isValid) {
                this.logger.warn('⚠️ Midtrans: Invalid webhook signature', { order_id });
            }

            return isValid;
        } catch (error: any) {
            this.logger.error('❌ Midtrans: Signature verification failed', {
                error: error.message,
            });
            return false;
        }
    }

    /**
     * Parse transaction status to order status
     */
    parseTransactionStatus(
        transactionStatus: string,
        fraudStatus?: string,
    ): 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED' {
        // Midtrans transaction_status mapping
        // https://docs.midtrans.com/docs/http-notification-transaction-status

        if (transactionStatus === 'capture') {
            // For credit card
            if (fraudStatus === 'accept') {
                return 'PAID';
            } else if (fraudStatus === 'challenge') {
                return 'PENDING';
            } else {
                return 'FAILED';
            }
        } else if (transactionStatus === 'settlement') {
            return 'PAID';
        } else if (transactionStatus === 'pending') {
            return 'PENDING';
        } else if (
            transactionStatus === 'deny' ||
            transactionStatus === 'cancel' ||
            transactionStatus === 'expire'
        ) {
            if (transactionStatus === 'expire') {
                return 'EXPIRED';
            }
            return 'FAILED';
        }

        return 'PENDING';
    }

    /**
     * Check if Midtrans is configured
     */
    isConfigured(): boolean {
        return !!this.serverKey;
    }
}