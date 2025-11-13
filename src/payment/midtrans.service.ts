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
            this.logger.warn('⚠️ Midtrans credentials not configured');
        }

        // Initialize Midtrans Snap
        this.snap = new midtransClient.Snap({
            isProduction: this.isProduction,
            serverKey: this.serverKey,
            clientKey: clientKey,
        });
    }

    /**
     * Check if Midtrans is configured
     */
    isConfigured(): boolean {
        return !!this.serverKey && !!this.configService.get<string>('MIDTRANS_CLIENT_KEY');
    }

    /**
     * Create Snap token for payment
     */
    async createSnapToken(orderData: MidtransSnapRequest): Promise<MidtransSnapResponse> {
        try {
            this.logger.info('💳 Midtrans: Creating Snap token', {
                orderId: orderData.transaction_details.order_id,
                amount: orderData.transaction_details.gross_amount,
                itemsCount: orderData.item_details?.length || 0,
            });

            // Log item details for debugging
            if (orderData.item_details) {
                const itemsTotal = orderData.item_details.reduce((sum, item) => {
                    return sum + (item.price * item.quantity);
                }, 0);

                this.logger.info('📦 Item details summary', {
                    orderId: orderData.transaction_details.order_id,
                    itemsTotal,
                    grossAmount: orderData.transaction_details.gross_amount,
                    match: itemsTotal === orderData.transaction_details.gross_amount,
                });
            }

            const transaction = await this.snap.createTransaction(orderData);

            this.logger.info('✅ Midtrans: Snap token created', {
                orderId: orderData.transaction_details.order_id,
                token: transaction.token.substring(0, 20) + '...',
            });

            return {
                token: transaction.token,
                redirect_url: transaction.redirect_url,
            };
        } catch (error: any) {
            this.logger.error('❌ Midtrans: Failed to create Snap token', {
                error: error.message,
                apiResponse: error.ApiResponse,
                httpStatusCode: error.httpStatusCode,
            });

            // Format error message for user
            let errorMessage = 'Failed to create payment. ';

            if (error.ApiResponse?.error_messages) {
                errorMessage += error.ApiResponse.error_messages.join(', ');
            } else if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Please try again or contact support.';
            }

            throw new BadRequestException(errorMessage);
        }
    }

    /**
     * ✅ Verify Midtrans signature
     * Formula: SHA512(order_id + status_code + gross_amount + server_key)
     * Ref: https://docs.midtrans.com/en/after-payment/http-notification#verifying-notification-authenticity
     */
    async verifySignature(notification: MidtransNotification): Promise<boolean> {
        const { order_id, status_code, gross_amount, signature_key } = notification;

        if (!order_id || !status_code || !gross_amount || !signature_key) {
            this.logger.warn('⚠️ Missing required fields for signature verification', {
                hasOrderId: !!order_id,
                hasStatusCode: !!status_code,
                hasGrossAmount: !!gross_amount,
                hasSignatureKey: !!signature_key,
            });
            return false;
        }

        try {
            // Generate expected signature
            // IMPORTANT: gross_amount must be formatted without decimal if integer
            const grossAmountStr = gross_amount.toString();
            const stringToHash = `${order_id}${status_code}${grossAmountStr}${this.serverKey}`;

            const hash = crypto
                .createHash('sha512')
                .update(stringToHash)
                .digest('hex');

            const isValid = hash === signature_key;

            this.logger.info('🔐 Signature verification', {
                orderId: order_id,
                statusCode: status_code,
                grossAmount: grossAmountStr,
                expectedSignature: hash.substring(0, 20) + '...',
                receivedSignature: signature_key.substring(0, 20) + '...',
                isValid,
            });

            return isValid;
        } catch (error: any) {
            this.logger.error('❌ Signature verification failed', {
                error: error.message,
                notification,
            });
            return false;
        }
    }

    /**
     * Get transaction status from Midtrans
     */
    async getTransactionStatus(orderId: string): Promise<any> {
        try {
            this.logger.info('🔍 Checking transaction status', { orderId });

            const statusResponse = await this.snap.transaction.status(orderId);

            this.logger.info('✅ Transaction status retrieved', {
                orderId,
                status: statusResponse.transaction_status,
                fraudStatus: statusResponse.fraud_status,
            });

            return statusResponse;
        } catch (error: any) {
            this.logger.error('❌ Failed to get transaction status', {
                orderId,
                error: error.message,
            });
            throw new BadRequestException('Failed to get transaction status');
        }
    }

    /**
     * Cancel transaction
     */
    async cancelTransaction(orderId: string): Promise<any> {
        try {
            this.logger.info('🚫 Cancelling transaction', { orderId });

            const cancelResponse = await this.snap.transaction.cancel(orderId);

            this.logger.info('✅ Transaction cancelled', {
                orderId,
                status: cancelResponse.transaction_status,
            });

            return cancelResponse;
        } catch (error: any) {
            this.logger.error('❌ Failed to cancel transaction', {
                orderId,
                error: error.message,
            });
            throw new BadRequestException('Failed to cancel transaction');
        }
    }

    /**
     * Get Snap payment page URL
     */
    getSnapUrl(token: string): string {
        const baseUrl = this.isProduction
            ? 'https://app.midtrans.com/snap/v3/redirection'
            : 'https://app.sandbox.midtrans.com/snap/v3/redirection';

        return `${baseUrl}/${token}`;
    }
}