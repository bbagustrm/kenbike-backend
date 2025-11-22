// src/payment/payment.service.ts

import {
    Injectable,
    Inject,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
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
     * ✅ FIXED: Create Midtrans Snap payment with proper item_details calculation
     */
    private async createMidtransPayment(order: any): Promise<PaymentResponse> {
        if (!this.midtransService.isConfigured()) {
            throw new BadRequestException('Midtrans payment is not configured');
        }

        // Ensure order is in IDR
        if (order.currency !== 'IDR') {
            throw new BadRequestException('Midtrans only supports IDR currency');
        }

        // ✅ FIX: Build item_details properly to match gross_amount
        const item_details: any[] = [];

        // Add order items (with discount already applied)
        order.items.forEach((item: any) => {
            const priceAfterDiscount = Math.round(item.pricePerItem - item.discount);
            item_details.push({
                id: item.sku || `ITEM-${item.productName.substring(0, 20)}`,
                price: priceAfterDiscount,
                quantity: item.quantity,
                name: `${item.productName} - ${item.variantName}`.substring(0, 50),
            });
        });

        // Add tax as separate item (REQUIRED by Midtrans)
        if (order.tax > 0) {
            item_details.push({
                id: 'TAX',
                price: order.tax,
                quantity: 1,
                name: 'PPN 11%',
            });
        }

        // Add shipping cost as separate item (REQUIRED by Midtrans)
        if (order.shippingCost > 0) {
            item_details.push({
                id: 'SHIPPING',
                price: order.shippingCost,
                quantity: 1,
                name: order.shippingMethod
                    ? `Shipping - ${order.shippingMethod}`.substring(0, 50)
                    : 'Shipping Cost',
            });
        }

        // ✅ Calculate total from item_details for verification
        const calculatedTotal = item_details.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        // Log for debugging
        this.logger.info('💰 Midtrans amount calculation', {
            orderNumber: order.orderNumber,
            orderTotal: order.total,
            calculatedTotal,
            difference: order.total - calculatedTotal,
            itemsCount: item_details.length,
        });

        // Warn if there's a mismatch
        if (Math.abs(order.total - calculatedTotal) > 1) {
            this.logger.warn('⚠️ Total mismatch detected', {
                orderTotal: order.total,
                calculatedTotal,
                difference: order.total - calculatedTotal,
            });
        }

        // Prepare Midtrans request
        const midtransRequest: MidtransSnapRequest = {
            transaction_details: {
                order_id: order.orderNumber,
                gross_amount: calculatedTotal, // Use calculated total for exact match
            },
            customer_details: {
                first_name: order.user.firstName || 'Customer',
                last_name: order.user.lastName || '',
                email: order.user.email,
                phone: order.recipientPhone || order.user.phoneNumber || '',
            },
            item_details: item_details, // ✅ Use properly calculated item_details
            shipping_address: {
                first_name: order.recipientName.split(' ')[0] || order.recipientName,
                last_name: order.recipientName.split(' ').slice(1).join(' ') || '',
                phone: order.recipientPhone,
                address: order.shippingAddress,
                city: order.shippingCity,
                postal_code: order.shippingPostalCode,
                country_code: 'IDN',
            },
        };

        try {
            // Create Snap token
            const snapResponse = await this.midtransService.createSnapToken(midtransRequest);

            // Update order with payment info
            await this.prisma.order.update({
                where: { id: order.id },
                data: {
                    paymentMethod: 'MIDTRANS_SNAP',
                    paymentProvider: 'MIDTRANS',
                    paymentId: snapResponse.token,
                },
            });

            this.logger.info('✅ Midtrans payment created', {
                orderNumber: order.orderNumber,
                token: snapResponse.token.substring(0, 20) + '...',
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
        } catch (error: any) {
            this.logger.error('❌ Failed to create Midtrans payment', {
                error: error.message,
                orderNumber: order.orderNumber,
            });
            throw error;
        }
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

        // Prepare PayPal request
        const paypalRequest: PayPalOrderRequest = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: order.orderNumber,
                    amount: {
                        currency_code: 'USD',
                        value: order.total.toFixed(2),
                        breakdown: {
                            item_total: {
                                currency_code: 'USD',
                                value: (order.subtotal - order.discount).toFixed(2),
                            },
                            tax_total: {
                                currency_code: 'USD',
                                value: order.tax.toFixed(2),
                            },
                            shipping: {
                                currency_code: 'USD',
                                value: order.shippingCost.toFixed(2),
                            },
                        },
                    },
                    items: order.items.map((item: any) => ({
                        name: `${item.productName} - ${item.variantName}`,
                        quantity: item.quantity.toString(),
                        unit_amount: {
                            currency_code: 'USD',
                            value: (item.pricePerItem - item.discount).toFixed(2),
                        },
                        sku: item.sku,
                    })),
                    shipping: {
                        name: {
                            full_name: order.recipientName,
                        },
                        address: {
                            address_line_1: order.shippingAddress,
                            admin_area_2: order.shippingCity,
                            admin_area_1: order.shippingProvince || '',
                            postal_code: order.shippingPostalCode,
                            country_code: order.shippingCountry,
                        },
                    },
                },
            ],
            application_context: {
                brand_name: 'KenBike',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: `${this.frontendUrl}/orders/${order.orderNumber}?payment=success`,
                cancel_url: `${this.frontendUrl}/orders/${order.orderNumber}?payment=cancelled`,
            },
        };

        try {
            const paypalResponse = await this.paypalService.createOrder(paypalRequest);

            // Update order with payment info
            await this.prisma.order.update({
                where: { id: order.id },
                data: {
                    paymentMethod: 'PAYPAL',
                    paymentProvider: 'PAYPAL',
                    paymentId: paypalResponse.id,
                },
            });

            this.logger.info('✅ PayPal payment created', {
                orderNumber: order.orderNumber,
                paypalOrderId: paypalResponse.id,
            });

            // Find approval URL
            const approvalUrl = paypalResponse.links.find(
                (link) => link.rel === 'approve',
            )?.href;

            if (!approvalUrl) {
                throw new BadRequestException('PayPal approval URL not found');
            }

            return {
                success: true,
                message: 'Payment created successfully',
                data: {
                    order_number: order.orderNumber,
                    payment_method: 'PAYPAL',
                    payment_url: approvalUrl,
                    payment_id: paypalResponse.id,
                    expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
                },
            };
        } catch (error: any) {
            this.logger.error('❌ Failed to create PayPal payment', {
                error: error.message,
                orderNumber: order.orderNumber,
            });
            throw error;
        }
    }

    /**
     * Capture PayPal payment after user approval
     */
    async capturePayPalPayment(
        userId: string,
        dto: CapturePayPalPaymentDto,
    ): Promise<PaymentResponse> {
        const { order_number, paypal_order_id } = dto;

        this.logger.info('💰 Capturing PayPal payment', {
            userId,
            orderNumber: order_number,
            paypalOrderId: paypal_order_id,
        });

        const order = await this.prisma.order.findUnique({
            where: { orderNumber: order_number },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new BadRequestException('You do not have permission to access this order');
        }

        if (order.paymentId !== paypal_order_id) {
            throw new BadRequestException('PayPal order ID does not match');
        }

        try {
            const captureResponse = await this.paypalService.capturePayment(paypal_order_id);

            // Update order status to PAID
            await this.prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                },
            });

            this.logger.info('✅ PayPal payment captured', {
                orderNumber: order.orderNumber,
                captureId: captureResponse.purchase_units[0].payments.captures[0].id,
            });

            return {
                success: true,
                message: 'Payment captured successfully',
                data: {
                    order_number: order.orderNumber,
                    payment_method: 'PAYPAL',
                    payment_id: paypal_order_id,
                },
            };
        } catch (error: any) {
            this.logger.error('❌ Failed to capture PayPal payment', {
                error: error.message,
                orderNumber: order.orderNumber,
            });
            throw error;
        }
    }

    /**
     * Get payment status
     */
    async getPaymentStatus(userId: string, orderNumber: string): Promise<PaymentStatusResponse> {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            select: {
                id: true,
                orderNumber: true,
                userId: true,
                status: true,
                total: true,
                currency: true,
                paymentMethod: true,
                paymentProvider: true,
                paymentId: true,
                paidAt: true,
                createdAt: true,
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        // Determine payment status based on order status
        let paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' = 'PENDING';

        if (
            order.status === 'PAID' ||
            order.status === 'PROCESSING' ||
            order.status === 'SHIPPED' ||
            order.status === 'DELIVERED' ||
            order.status === 'COMPLETED'
        ) {
            paymentStatus = 'PAID';
        } else if (order.status === 'CANCELLED') {
            paymentStatus = 'EXPIRED';
        } else if (order.status === 'FAILED') {
            paymentStatus = 'FAILED';
        }

        return {
            order_number: order.orderNumber,
            payment_status: paymentStatus,
            payment_method: order.paymentMethod || '',
            payment_id: order.paymentId || undefined,
            paid_at: order.paidAt || undefined,
            amount: order.total,
            currency: order.currency,
        };
    }

    /**
     * Handle successful payment (called by webhook)
     */
    async handlePaymentSuccess(
        orderNumber: string,
        provider: string,
        paymentData: any,
    ): Promise<void> {
        this.logger.info('✅ Processing payment success', {
            orderNumber,
            provider,
        });

        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.status === 'PAID') {
            this.logger.info('⚠️ Order already marked as paid', { orderNumber });
            return;
        }

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'PAID',
                paidAt: new Date(),
            },
        });

        this.logger.info('✅ Order marked as paid', { orderNumber });
        // TODO Phase 4: Send email notification
    }

    /**
     * Handle failed payment (called by webhook)
     */
    async handlePaymentFailed(
        orderNumber: string,
        provider: string,
        reason: string,
    ): Promise<void> {
        this.logger.info('❌ Processing payment failure', {
            orderNumber,
            provider,
            reason,
        });

        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'FAILED',
            },
        });

        this.logger.info('✅ Order marked as failed', { orderNumber });
        // TODO Phase 4: Send email notification
    }

    /**
     * Handle expired payment (called by webhook)
     */
    async handlePaymentExpired(orderNumber: string, provider: string): Promise<void> {
        this.logger.info('⏰ Processing payment expiration', {
            orderNumber,
            provider,
        });

        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            include: { items: true },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // Restore stock and cancel order
        await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: order.id },
                data: {
                    status: 'CANCELLED',
                    canceledAt: new Date(),
                },
            });

            // Restore stock
            for (const item of order.items) {
                if (item.variantId) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: {
                            stock: {
                                increment: item.quantity,
                            },
                        },
                    });
                }
            }
        });

        this.logger.info('✅ Order cancelled due to payment expiration', { orderNumber });
        // TODO Phase 4: Send email notification
    }

    /**
     * ✅ NEW: Mark order as paid (called by PayPal webhook)
     */
    async markOrderAsPaid(
        orderNumber: string,
        paymentData: {
            paymentId: string;
            paymentProvider: string;
        },
    ): Promise<void> {
        this.logger.info('✅ Marking order as paid (PayPal)', {
            orderNumber,
            paymentId: paymentData.paymentId,
        });

        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.status === 'PAID') {
            this.logger.info('⚠️ Order already marked as paid', { orderNumber });
            return;
        }

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                paymentId: paymentData.paymentId,
                paymentProvider: paymentData.paymentProvider.toUpperCase(),
            },
        });

        this.logger.info('✅ Order marked as paid', { orderNumber });
        // TODO Phase 4: Send email notification
    }

    /**
     * ✅ NEW: Mark order as failed (called by PayPal webhook)
     */
    async markOrderAsFailed(orderNumber: string, reason: string): Promise<void> {
        this.logger.info('❌ Marking order as failed', {
            orderNumber,
            reason,
        });

        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'FAILED',
            },
        });

        this.logger.info('✅ Order marked as failed', { orderNumber, reason });
        // TODO Phase 4: Send email notification
    }
}