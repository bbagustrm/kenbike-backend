// src/payment/payment.service.ts

import {
    Injectable,
    Inject,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { MidtransService } from './midtrans.service';
import { PayPalService } from './paypal.service';
import {
    CreatePaymentDto,
    CapturePayPalPaymentDto,
} from './dto/payment.dto';
import {
    PaymentResponse,
    PaymentStatusResponse,
    MidtransSnapRequest,
    PayPalOrderRequest,
} from './interfaces/payment.interface';

@Injectable()
export class PaymentService {
    private readonly frontendUrl: string;
    private readonly usdToIdrRate: number;

    constructor(
        private prisma: PrismaService,
        private midtransService: MidtransService,
        private paypalService: PayPalService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
        this.usdToIdrRate = parseFloat(this.configService.get<string>('USD_TO_IDR_RATE') || '15700');
    }

    /**
     * Create payment for an order
     */
    async createPayment(userId: string, dto: CreatePaymentDto): Promise<PaymentResponse> {
        const { order_number, payment_method } = dto;

        this.logger.info('💳 Creating payment', {
            userId,
            orderNumber: order_number,
            paymentMethod: payment_method,
        });

        // Get order
        const order = await this.prisma.order.findUnique({
            where: { orderNumber: order_number },
            include: {
                items: true,
                user: true,
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // Verify user owns the order
        if (order.userId !== userId) {
            throw new BadRequestException('You do not have permission to pay for this order');
        }

        // Check order status
        if (order.status !== 'PENDING') {
            throw new BadRequestException(
                `Order is already ${order.status}. Only PENDING orders can be paid.`,
            );
        }

        // Check if order already has a payment
        if (order.paymentId) {
            throw new BadRequestException('Order already has a payment. Please check payment status.');
        }

        // Create payment based on method
        if (payment_method === 'MIDTRANS_SNAP') {
            return await this.createMidtransPayment(order);
        } else if (payment_method === 'PAYPAL') {
            return await this.createPayPalPayment(order);
        }

        throw new BadRequestException('Invalid payment method');
    }

    /**
     * Create Midtrans Snap payment
     */
    private async createMidtransPayment(order: any): Promise<PaymentResponse> {
        if (!this.midtransService.isConfigured()) {
            throw new BadRequestException('Midtrans payment is not configured');
        }

        // Ensure order is in IDR
        if (order.currency !== 'IDR') {
            throw new BadRequestException('Midtrans only supports IDR currency');
        }

        // Prepare Midtrans request
        const midtransRequest: MidtransSnapRequest = {
            transaction_details: {
                order_id: order.orderNumber,
                gross_amount: order.total,
            },
            customer_details: {
                first_name: order.user.firstName,
                last_name: order.user.lastName,
                email: order.user.email,
                phone: order.recipientPhone || order.user.phoneNumber || '',
            },
            item_details: order.items.map((item: any) => ({
                id: item.sku,
                price: Math.round(item.pricePerItem),
                quantity: item.quantity,
                name: `${item.productName} - ${item.variantName}`,
            })),
            shipping_address: {
                first_name: order.recipientName.split(' ')[0] || order.recipientName,
                last_name: order.recipientName.split(' ').slice(1).join(' ') || '',
                phone: order.recipientPhone,
                address: order.shippingAddress,
                city: order.shippingCity,
                postal_code: order.shippingPostalCode,
                country_code: order.shippingCountry,
            },
        };

        // Create Snap token
        const snapResponse = await this.midtransService.createSnapToken(midtransRequest);

        // Update order with payment info
        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentProvider: 'midtrans',
            },
        });

        this.logger.info('✅ Midtrans payment created', {
            orderNumber: order.orderNumber,
            token: snapResponse.token,
        });

        return {
            success: true,
            message: 'Payment created successfully',
            data: {
                order_number: order.orderNumber,
                payment_method: 'MIDTRANS_SNAP',
                payment_url: snapResponse.redirect_url,
                token: snapResponse.token,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
        };
    }

    /**
     * Create PayPal payment
     */
    private async createPayPalPayment(order: any): Promise<PaymentResponse> {
        if (!this.paypalService.isConfigured()) {
            throw new BadRequestException('PayPal payment is not configured');
        }

        // Ensure order is in USD
        if (order.currency !== 'USD') {
            throw new BadRequestException('PayPal only supports USD currency');
        }

        // Convert IDR to USD (2 decimal places)
        const totalUSD = (order.total / this.usdToIdrRate).toFixed(2);
        const shippingUSD = (order.shippingCost / this.usdToIdrRate).toFixed(2);
        const taxUSD = (order.tax / this.usdToIdrRate).toFixed(2);
        const itemsTotalUSD = (parseFloat(totalUSD) - parseFloat(shippingUSD) - parseFloat(taxUSD)).toFixed(2);

        // Prepare PayPal request
        const paypalRequest: PayPalOrderRequest = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: order.orderNumber,
                    amount: {
                        currency_code: 'USD',
                        value: totalUSD,
                        breakdown: {
                            item_total: {
                                currency_code: 'USD',
                                value: itemsTotalUSD,
                            },
                            shipping: {
                                currency_code: 'USD',
                                value: shippingUSD,
                            },
                            tax_total: {
                                currency_code: 'USD',
                                value: taxUSD,
                            },
                        },
                    },
                    items: order.items.map((item: any) => ({
                        name: `${item.productName} - ${item.variantName}`,
                        unit_amount: {
                            currency_code: 'USD',
                            value: (item.pricePerItem / this.usdToIdrRate).toFixed(2),
                        },
                        quantity: item.quantity.toString(),
                    })),
                    shipping: {
                        name: {
                            full_name: order.recipientName,
                        },
                        address: {
                            address_line_1: order.shippingAddress,
                            admin_area_2: order.shippingCity,
                            postal_code: order.shippingPostalCode,
                            country_code: order.shippingCountry,
                        },
                    },
                },
            ],
            application_context: {
                brand_name: 'Kenbike Store',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: `${this.frontendUrl}/payment/paypal/success?order=${order.orderNumber}`,
                cancel_url: `${this.frontendUrl}/payment/paypal/cancel?order=${order.orderNumber}`,
            },
        };

        // Create PayPal order
        const paypalResponse = await this.paypalService.createOrder(paypalRequest);

        // Get approval URL
        const approveLink = paypalResponse.links.find((link) => link.rel === 'approve');

        if (!approveLink) {
            throw new BadRequestException('Failed to get PayPal approval URL');
        }

        // Update order with payment info
        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentProvider: 'paypal',
                paymentId: paypalResponse.id,
            },
        });

        this.logger.info('✅ PayPal payment created', {
            orderNumber: order.orderNumber,
            paypalOrderId: paypalResponse.id,
        });

        return {
            success: true,
            message: 'Payment created successfully',
            data: {
                order_number: order.orderNumber,
                payment_method: 'PAYPAL',
                payment_url: approveLink.href,
                payment_id: paypalResponse.id,
            },
        };
    }

    /**
     * Capture PayPal payment after user approval
     */
    async capturePayPalPayment(userId: string, dto: CapturePayPalPaymentDto): Promise<PaymentResponse> {
        const { order_number, paypal_order_id } = dto;

        this.logger.info('💰 Capturing PayPal payment', {
            userId,
            orderNumber: order_number,
            paypalOrderId: paypal_order_id,
        });

        // Get order
        const order = await this.prisma.order.findUnique({
            where: { orderNumber: order_number },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // Verify user owns the order
        if (order.userId !== userId) {
            throw new BadRequestException('You do not have permission to capture this payment');
        }

        // Verify order status
        if (order.status !== 'PENDING') {
            throw new BadRequestException(`Order is already ${order.status}`);
        }

        // Capture payment
        const captureResult = await this.paypalService.capturePayment(paypal_order_id);

        // Check capture status
        if (captureResult.status === 'COMPLETED') {
            // Update order to PAID
            await this.prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                    paymentId: captureResult.purchase_units[0].payments.captures[0].id,
                },
            });

            this.logger.info('✅ Order marked as PAID', {
                orderNumber: order.orderNumber,
                paymentId: captureResult.purchase_units[0].payments.captures[0].id,
            });

            return {
                success: true,
                message: 'Payment captured successfully',
                data: {
                    order_number: order.orderNumber,
                    payment_method: 'PAYPAL',
                    payment_id: captureResult.purchase_units[0].payments.captures[0].id,
                },
            };
        } else {
            throw new BadRequestException('Payment capture failed. Please try again.');
        }
    }

    /**
     * Get payment status for an order
     */
    async getPaymentStatus(userId: string, orderNumber: string): Promise<PaymentStatusResponse> {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // Verify user owns the order
        if (order.userId !== userId) {
            throw new BadRequestException('You do not have permission to view this payment');
        }

        let paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' = 'PENDING';

        if (order.status === 'PAID') {
            paymentStatus = 'PAID';
        } else if (order.status === 'FAILED') {
            paymentStatus = 'FAILED';
        } else if (order.status === 'CANCELLED') {
            paymentStatus = 'EXPIRED';
        }

        return {
            order_number: order.orderNumber,
            payment_status: paymentStatus,
            payment_method: order.paymentMethod || 'Unknown',
            payment_id: order.paymentId || undefined,
            paid_at: order.paidAt || undefined,
            amount: order.total,
            currency: order.currency,
        };
    }

    /**
     * Mark order as paid (called by webhook handlers)
     */
    async markOrderAsPaid(orderNumber: string, paymentData: any): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            this.logger.warn('⚠️ Order not found for payment', { orderNumber });
            return;
        }

        if (order.status === 'PAID') {
            this.logger.info('ℹ️ Order already paid', { orderNumber });
            return;
        }

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                paymentId: paymentData.paymentId || order.paymentId,
            },
        });

        this.logger.info('✅ Order marked as PAID', {
            orderNumber,
            paymentId: paymentData.paymentId,
        });

        // TODO Phase 4: Send payment confirmation email
    }

    /**
     * Mark order as failed (called by webhook handlers)
     */
    async markOrderAsFailed(orderNumber: string, reason: string): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            this.logger.warn('⚠️ Order not found for failed payment', { orderNumber });
            return;
        }

        if (order.status !== 'PENDING') {
            this.logger.info('ℹ️ Order not in PENDING status', {
                orderNumber,
                currentStatus: order.status,
            });
            return;
        }

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'FAILED',
            },
        });

        this.logger.info('❌ Order marked as FAILED', { orderNumber, reason });

        // TODO Phase 4: Send payment failed email
    }
}