// src/order/order.service.ts

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
import { BiteshipService } from './biteship.service';
import { InternationalShippingService } from './international-shipping.service';
import { PaginationUtil } from '../utils/pagination.util';
import { PaymentService } from '../payment/payment.service';
import { PaymentMethod } from '@prisma/client';
import {
    CalculateShippingDto,
    CalculateShippingResponse,
    ShippingOption,
} from './dto/calculate-shipping.dto';
import {
    CreateOrderDto,
    CreateOrderResponse,
} from './dto/create-order.dto';
import {
    GetOrdersDto,
    GetAllOrdersDto,
    CancelOrderDto,
    UpdateOrderStatusDto,
} from './dto/order-management.dto';
import { BiteshipOrderRequest } from './interfaces/shipping.interface';

@Injectable()
export class OrderService {
    private readonly taxRate: number;
    private readonly usdToIdrRate: number;

    constructor(
        private prisma: PrismaService,
        private biteshipService: BiteshipService,
        private internationalShippingService: InternationalShippingService,
        private configService: ConfigService,
        private paymentService: PaymentService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.taxRate = parseFloat(this.configService.get<string>('TAX_RATE') || '0.11');
        this.usdToIdrRate = parseFloat(this.configService.get<string>('USD_TO_IDR_RATE') || '15700');
    }

    /**
     * Calculate shipping costs for domestic or international
     */
    async calculateShipping(
        userId: string,
        dto: CalculateShippingDto,
    ): Promise<CalculateShippingResponse> {
        const { country, city, postal_code, total_weight, courier } = dto;

        this.logger.info('📦 Calculating shipping', {
            userId,
            country,
            city,
            weight: total_weight,
        });

        const options: ShippingOption[] = [];
        const isDomestic = country.toUpperCase() === 'ID';
        const shippingType = isDomestic ? 'DOMESTIC' : 'INTERNATIONAL';

        if (isDomestic) {
            if (!this.biteshipService.isConfigured()) {
                throw new BadRequestException(
                    'Domestic shipping is not configured. Please contact support.',
                );
            }

            try {
                const items = [
                    {
                        name: 'Order Items',
                        value: 100000,
                        weight: total_weight,
                        quantity: 1,
                    },
                ];

                const ratesResponse = await this.biteshipService.getRates(
                    postal_code,
                    items,
                    courier,
                );

                for (const rate of ratesResponse.pricing) {
                    options.push({
                        type: 'DOMESTIC',
                        courier: rate.courier_code,
                        service: rate.type,
                        serviceName: `${rate.courier_name} ${rate.courier_service_name}`,
                        description: rate.description,
                        cost: rate.price,
                        estimatedDays: this.parseDuration(rate.shipment_duration_range),
                        biteshipPriceId: `${rate.courier_code}_${rate.type}`,
                        insurance: {
                            required: rate.available_for_insurance,
                            fee: 0,
                        },
                    });
                }
            } catch (error: any) {
                this.logger.error('❌ Failed to get domestic shipping rates', {
                    error: error.message,
                });
                throw error;
            }
        } else {
            try {
                const calculation = await this.internationalShippingService.calculateShippingCost(
                    country,
                    total_weight,
                );

                options.push({
                    type: 'INTERNATIONAL',
                    serviceName: calculation.zone.name,
                    description: `International shipping to ${city}, ${country}. Estimated ${calculation.zone.minDays}-${calculation.zone.maxDays} days.`,
                    cost: calculation.cost,
                    estimatedDays: {
                        min: calculation.zone.minDays,
                        max: calculation.zone.maxDays,
                    },
                    zoneId: calculation.zone.id,
                    zoneName: calculation.zone.name,
                });
            } catch (error: any) {
                this.logger.error('❌ Failed to calculate international shipping', {
                    error: error.message,
                });
                throw error;
            }
        }

        if (options.length === 0) {
            throw new BadRequestException(
                'No shipping options available for this destination. Please check your address.',
            );
        }

        this.logger.info(`✅ Found ${options.length} shipping options`);

        return {
            destination: {
                country,
                city,
                postalCode: postal_code,
            },
            totalWeight: total_weight,
            shippingType,
            options,
        };
    }

    /**
     * Parse shipping duration string (e.g., "2 - 3" -> {min: 2, max: 3})
     */
    private parseDuration(duration: string): { min: number; max: number } {
        const parts = duration.split('-').map((s) => parseInt(s.trim()));
        return {
            min: parts[0] || 1,
            max: parts[1] || parts[0] || 1,
        };
    }

    /**
     * Generate unique order number (format: ORD-YYYYMMDD-XXXX)
     */
    private async generateOrderNumber(): Promise<string> {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));

        const count = await this.prisma.order.count({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        });

        const sequence = (count + 1).toString().padStart(4, '0');
        return `ORD-${dateStr}-${sequence}`;
    }

    /**
     * Calculate order totals (subtotal, discount, tax, shipping, total)
     */
    private calculateOrderTotals(
        subtotal: number,
        discount: number,
        shippingCost: number,
    ): {
        subtotal: number;
        discount: number;
        tax: number;
        shippingCost: number;
        total: number;
    } {
        const taxableAmount = subtotal - discount;
        const tax = Math.round(taxableAmount * this.taxRate);
        const total = taxableAmount + tax + shippingCost;

        return {
            subtotal,
            discount,
            tax,
            shippingCost,
            total,
        };
    }

    /**
     * Create order from user's cart
     */
    async createOrder(userId: string, dto: CreateOrderDto): Promise<CreateOrderResponse> {
        this.logger.info('🛒 Creating order from cart', { userId });

        const cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                category: true,
                                promotion: true,
                                images: true,
                            },
                        },
                        variant: {
                            include: {
                                images: true,
                            },
                        },
                    },
                },
            },
        });

        if (!cart || cart.items.length === 0) {
            throw new BadRequestException('Cart is empty');
        }

        // Validate all products and variants
        for (const item of cart.items) {
            if (!item.product.isActive || item.product.deletedAt) {
                throw new BadRequestException(`Product ${item.product.name} is no longer available`);
            }

            if (!item.variant.isActive || item.variant.deletedAt) {
                throw new BadRequestException(
                    `Variant ${item.variant.variantName} of ${item.product.name} is no longer available`,
                );
            }

            if (item.variant.stock < item.quantity) {
                throw new BadRequestException(
                    `Insufficient stock for ${item.product.name} - ${item.variant.variantName}. ` +
                    `Available: ${item.variant.stock}, Requested: ${item.quantity}`,
                );
            }
        }

        // Calculate order items with pricing
        let subtotal = 0;
        let totalDiscount = 0;
        let totalWeight = 0;

        const orderItemsData = cart.items.map((item) => {
            const basePrice = dto.currency === 'USD'
                ? item.product.enPrice
                : item.product.idPrice;

            const discount = item.product.promotion
                ? Math.round(basePrice * item.product.promotion.discount)
                : 0;

            const pricePerItem = basePrice - discount;
            const itemSubtotal = pricePerItem * item.quantity;
            const itemDiscount = discount * item.quantity;

            subtotal += itemSubtotal;
            totalDiscount += itemDiscount;

            const itemWeight = (item.product.weight || 0) * item.quantity;
            totalWeight += itemWeight;

            return {
                productId: item.productId,
                variantId: item.variantId,
                productName: item.product.name,
                variantName: item.variant.variantName,
                sku: item.variant.sku,
                quantity: item.quantity,
                pricePerItem: basePrice,
                discount,
                subtotal: itemSubtotal,
                productImage: item.product.images?.[0]?.imageUrl || null,
            };
        });

        // Calculate shipping cost
        let shippingCost = 0;
        let shippingData: any = {};

        if (dto.shipping_type === 'DOMESTIC') {
            const items = [{ name: 'Order', value: subtotal, weight: totalWeight, quantity: 1 }];
            const rates = await this.biteshipService.getRates(
                dto.shipping_postal_code,
                items,
                dto.biteship_courier,
            );

            const selectedRate = rates.pricing.find(
                (r) => r.courier_code === dto.biteship_courier && r.type === dto.biteship_service,
            );

            if (!selectedRate) {
                throw new BadRequestException('Selected shipping option is no longer available');
            }

            shippingCost = selectedRate.price;
            shippingData = {
                biteshipCourier: dto.biteship_courier,
                biteshipService: dto.biteship_service,
                shippingMethod: `${selectedRate.courier_name} ${selectedRate.courier_service_name}`,
            };
        } else {
            const zone = await this.internationalShippingService.getZoneById(dto.shipping_zone_id!);
            const calculation = await this.internationalShippingService.calculateShippingCost(
                dto.shipping_country,
                totalWeight,
            );

            shippingCost = calculation.cost;
            shippingData = {
                shippingZoneId: zone.id,
                shippingMethod: zone.name,
            };
        }

        const totals = this.calculateOrderTotals(subtotal, totalDiscount, shippingCost);
        const orderNumber = await this.generateOrderNumber();
        const exchangeRate = dto.currency === 'USD' ? this.usdToIdrRate : undefined;

        // Create order in database transaction
        const order = await this.prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    status: 'PENDING',
                    subtotal: totals.subtotal,
                    discount: totals.discount,
                    tax: totals.tax,
                    shippingCost: totals.shippingCost,
                    total: totals.total,
                    currency: dto.currency,
                    exchangeRate,
                    paymentMethod: dto.payment_method || null,
                    shippingType: dto.shipping_type,
                    ...shippingData,
                    recipientName: dto.recipient_name,
                    recipientPhone: dto.recipient_phone,
                    shippingAddress: dto.shipping_address,
                    shippingCity: dto.shipping_city,
                    shippingProvince: dto.shipping_province,
                    shippingCountry: dto.shipping_country,
                    shippingPostalCode: dto.shipping_postal_code,
                    shippingNotes: dto.shipping_notes,
                },
            });

            await tx.orderItem.createMany({
                data: orderItemsData.map((item) => ({
                    ...item,
                    orderId: newOrder.id,
                })),
            });

            // Decrease product variant stock
            for (const item of cart.items) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: {
                        stock: {
                            decrement: item.quantity,
                        },
                    },
                });
            }

            // Clear cart
            await tx.cartItem.deleteMany({
                where: { cartId: cart.id },
            });

            return newOrder;
        });

        this.logger.info(`✅ Order created: ${orderNumber}`);

        return {
            message: 'Order created successfully',
            data: {
                id: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
                subtotal: order.subtotal,
                discount: order.discount,
                tax: order.tax,
                shippingCost: order.shippingCost,
                total: order.total,
                currency: order.currency,
                items: orderItemsData.map((item) => ({
                    productName: item.productName,
                    variantName: item.variantName,
                    quantity: item.quantity,
                    pricePerItem: item.pricePerItem,
                    subtotal: item.subtotal,
                })),
                shipping: {
                    type: order.shippingType,
                    method: order.shippingMethod,
                    recipientName: order.recipientName,
                    recipientPhone: order.recipientPhone,
                    address: order.shippingAddress,
                    city: order.shippingCity,
                    country: order.shippingCountry,
                    postalCode: order.shippingPostalCode,
                },
                paymentMethod: order.paymentMethod || undefined,
                createdAt: order.createdAt,
            },
        };
    }

    /**
     * ✅ NEW: Helper method to get order for payment processing
     */
    async getOrderForPayment(orderNumber: string, userId: string) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            include: {
                items: {
                    select: {
                        productName: true,
                        variantName: true,
                        quantity: true,
                        pricePerItem: true,
                        subtotal: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        if (order.status !== 'PENDING') {
            throw new BadRequestException(
                `Cannot process payment for order with status: ${order.status}`,
            );
        }

        return order;
    }

    /**
     * ✅ NEW: Update order payment info (called by payment service after payment created)
     */
    async updateOrderPayment(
        orderNumber: string,
        paymentData: {
            paymentMethod: string; // ex: "MIDTRANS_SNAP", "PAYPAL", "MANUAL"
            paymentProvider: string;
            paymentId: string;
        },
    ) {
        // Validasi agar string cocok dengan enum PaymentMethod
        if (!Object.values(PaymentMethod).includes(paymentData.paymentMethod as PaymentMethod)) {
            throw new Error(`Invalid payment method: ${paymentData.paymentMethod}`);
        }

        return this.prisma.order.update({
            where: { orderNumber },
            data: {
                paymentMethod: paymentData.paymentMethod as PaymentMethod,
                paymentProvider: paymentData.paymentProvider,
                paymentId: paymentData.paymentId,
            },
        });
    }

    /**
     * ✅ NEW: Mark order as paid (called by webhook after successful payment)
     */
    async markOrderAsPaid(orderNumber: string, paidAt?: Date) {
        this.logger.info(`💰 Marking order as paid: ${orderNumber}`);

        return this.prisma.order.update({
            where: { orderNumber },
            data: {
                status: 'PAID',
                paidAt: paidAt || new Date(),
            },
        });
    }

    /**
     * Get user's orders with pagination and filters
     */
    async getUserOrders(userId: string, dto: GetOrdersDto) {
        const { page, limit, status, sort_by, order, search } = dto;

        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: any = { userId };
        if (status) where.status = status;
        if (search) where.orderNumber = { contains: search, mode: 'insensitive' };

        const total = await this.prisma.order.count({ where });

        const orders = await this.prisma.order.findMany({
            where,
            include: {
                items: {
                    select: {
                        productName: true,
                        variantName: true,
                        quantity: true,
                        pricePerItem: true,
                        subtotal: true,
                        productImage: true,
                    },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: {
                [sort_by === 'created_at' ? 'createdAt' : sort_by]: order,
            },
        });

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data: orders.map((order) => ({
                id: order.id,
                order_number: order.orderNumber,
                status: order.status,
                subtotal: order.subtotal,
                discount: order.discount,
                tax: order.tax,
                shipping_cost: order.shippingCost,
                total: order.total,
                currency: order.currency,
                items_count: order.items.length,
                items: order.items,
                shipping: {
                    type: order.shippingType,
                    method: order.shippingMethod,
                    recipient_name: order.recipientName,
                    address: order.shippingAddress,
                    city: order.shippingCity,
                    country: order.shippingCountry,
                },
                tracking_number: order.trackingNumber,
                payment_method: order.paymentMethod,
                created_at: order.createdAt,
                paid_at: order.paidAt,
                shipped_at: order.shippedAt,
                delivered_at: order.deliveredAt,
            })),
        };
    }

    /**
     * Get order detail for user
     */
    async getOrderDetail(userId: string, orderNumber: string) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            include: {
                items: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        return {
            data: {
                id: order.id,
                order_number: order.orderNumber,
                status: order.status,
                subtotal: order.subtotal,
                discount: order.discount,
                tax: order.tax,
                shipping_cost: order.shippingCost,
                total: order.total,
                currency: order.currency,
                exchange_rate: order.exchangeRate,
                items: order.items.map((item) => ({
                    product_name: item.productName,
                    variant_name: item.variantName,
                    sku: item.sku,
                    quantity: item.quantity,
                    price_per_item: item.pricePerItem,
                    discount: item.discount,
                    subtotal: item.subtotal,
                    product_image: item.productImage,
                })),
                shipping: {
                    type: order.shippingType,
                    method: order.shippingMethod,
                    recipient_name: order.recipientName,
                    recipient_phone: order.recipientPhone,
                    address: order.shippingAddress,
                    city: order.shippingCity,
                    province: order.shippingProvince,
                    country: order.shippingCountry,
                    postal_code: order.shippingPostalCode,
                    notes: order.shippingNotes,
                },
                tracking_number: order.trackingNumber,
                biteship_order_id: order.biteshipOrderId,
                payment_method: order.paymentMethod,
                payment_id: order.paymentId,
                created_at: order.createdAt,
                paid_at: order.paidAt,
                shipped_at: order.shippedAt,
                delivered_at: order.deliveredAt,
                completed_at: order.completedAt,
                canceled_at: order.canceledAt,
            },
        };
    }

    /**
     * Cancel order (user can only cancel PENDING or FAILED orders)
     */
    async cancelOrder(userId: string, orderNumber: string, dto: CancelOrderDto) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            include: { items: true },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        if (!['PENDING', 'FAILED'].includes(order.status)) {
            throw new BadRequestException(
                'Order can only be cancelled if status is PENDING or FAILED',
            );
        }

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
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: {
                        stock: {
                            increment: item.quantity,
                        },
                    },
                });
            }
        });

        this.logger.info(`❌ Order cancelled: ${orderNumber}`);

        return {
            message: 'Order cancelled successfully',
        };
    }

    /**
     * Get all orders (Admin)
     */
    async getAllOrders(dto: GetAllOrdersDto) {
        const {
            page,
            limit,
            status,
            user_id,
            payment_method,
            shipping_type,
            date_from,
            date_to,
            sort_by,
            order,
            search,
        } = dto;

        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: any = {};

        if (status) where.status = status;
        if (user_id) where.userId = user_id;
        if (payment_method) where.paymentMethod = payment_method;
        if (shipping_type) where.shippingType = shipping_type;

        if (date_from || date_to) {
            where.createdAt = {};
            if (date_from) where.createdAt.gte = new Date(date_from);
            if (date_to) where.createdAt.lte = new Date(date_to);
        }

        if (search) {
            where.orderNumber = {
                contains: search,
                mode: 'insensitive',
            };
        }

        const total = await this.prisma.order.count({ where });

        const orders = await this.prisma.order.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                items: {
                    select: {
                        productName: true,
                        variantName: true,
                        quantity: true,
                        pricePerItem: true,
                        subtotal: true,
                    },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: {
                [sort_by === 'created_at' ? 'createdAt' : sort_by]: order,
            },
        });

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data: orders.map((order) => ({
                id: order.id,
                order_number: order.orderNumber,
                status: order.status,
                user: {
                    id: order.user.id,
                    email: order.user.email,
                    name: `${order.user.firstName} ${order.user.lastName}`,
                },
                subtotal: order.subtotal,
                discount: order.discount,
                tax: order.tax,
                shipping_cost: order.shippingCost,
                total: order.total,
                currency: order.currency,
                items_count: order.items.length,
                shipping: {
                    type: order.shippingType,
                    method: order.shippingMethod,
                    recipient_name: order.recipientName,
                    city: order.shippingCity,
                    country: order.shippingCountry,
                },
                tracking_number: order.trackingNumber,
                payment_method: order.paymentMethod,
                created_at: order.createdAt,
                paid_at: order.paidAt,
                shipped_at: order.shippedAt,
                delivered_at: order.deliveredAt,
            })),
        };
    }

    /**
     * Get order detail (Admin)
     */
    async getOrderDetailAdmin(orderNumber: string) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            include: {
                items: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        phoneNumber: true,
                    },
                },
                shippingZone: true,
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        return {
            data: {
                id: order.id,
                order_number: order.orderNumber,
                status: order.status,
                user: {
                    id: order.user.id,
                    email: order.user.email,
                    username: order.user.username,
                    name: `${order.user.firstName} ${order.user.lastName}`,
                    phone: order.user.phoneNumber,
                },
                subtotal: order.subtotal,
                discount: order.discount,
                tax: order.tax,
                shipping_cost: order.shippingCost,
                total: order.total,
                currency: order.currency,
                exchange_rate: order.exchangeRate,
                items: order.items.map((item) => ({
                    product_name: item.productName,
                    variant_name: item.variantName,
                    sku: item.sku,
                    quantity: item.quantity,
                    price_per_item: item.pricePerItem,
                    discount: item.discount,
                    subtotal: item.subtotal,
                    product_image: item.productImage,
                })),
                shipping: {
                    type: order.shippingType,
                    method: order.shippingMethod,
                    courier: order.biteshipCourier,
                    service: order.biteshipService,
                    zone: order.shippingZone?.name,
                    recipient_name: order.recipientName,
                    recipient_phone: order.recipientPhone,
                    address: order.shippingAddress,
                    city: order.shippingCity,
                    province: order.shippingProvince,
                    country: order.shippingCountry,
                    postal_code: order.shippingPostalCode,
                    notes: order.shippingNotes,
                },
                tracking_number: order.trackingNumber,
                biteship_order_id: order.biteshipOrderId,
                payment: {
                    method: order.paymentMethod,
                    provider: order.paymentProvider,
                    payment_id: order.paymentId,
                },
                timestamps: {
                    created_at: order.createdAt,
                    paid_at: order.paidAt,
                    shipped_at: order.shippedAt,
                    delivered_at: order.deliveredAt,
                    completed_at: order.completedAt,
                    canceled_at: order.canceledAt,
                    updated_at: order.updatedAt,
                },
            },
        };
    }

    /**
     * ✅ UPDATED: Update order status with Biteship integration
     */
    async updateOrderStatus(orderNumber: string, dto: UpdateOrderStatusDto) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            include: {
                items: true,
                user: {
                    select: {
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        const validTransitions: Record<string, string[]> = {
            PENDING: ['PAID', 'CANCELLED', 'FAILED'],
            PAID: ['PROCESSING', 'CANCELLED'],
            PROCESSING: ['SHIPPED', 'CANCELLED'],
            SHIPPED: ['DELIVERED', 'CANCELLED'],
            DELIVERED: ['COMPLETED'],
            COMPLETED: [],
            CANCELLED: [],
            FAILED: ['PENDING'],
        };

        if (!validTransitions[order.status]?.includes(dto.status)) {
            throw new BadRequestException(
                `Cannot transition from ${order.status} to ${dto.status}`,
            );
        }

        const updateData: any = {
            status: dto.status,
        };

        // ✅ PHASE 2.5: Create Biteship order when shipping
        if (dto.status === 'SHIPPED') {
            updateData.shippedAt = new Date();

            // Create order in Biteship for DOMESTIC orders
            if (order.shippingType === 'DOMESTIC' && order.biteshipCourier && order.biteshipService) {
                try {
                    this.logger.info('📦 Creating Biteship order', {
                        orderNumber: order.orderNumber,
                        courier: order.biteshipCourier,
                        service: order.biteshipService,
                    });

                    // Prepare items for Biteship
                    const biteshipItems = order.items.map((item) => ({
                        name: item.productName,
                        description: item.variantName,
                        value: item.pricePerItem,
                        quantity: item.quantity,
                        weight: 1000, // Default 1kg per item (adjust as needed)
                    }));

                    // Prepare Biteship order request
                    const biteshipOrderRequest: BiteshipOrderRequest = {
                        origin_contact_name: this.configService.get<string>('WAREHOUSE_NAME') || 'Kenbike Store',
                        origin_contact_phone: this.configService.get<string>('WAREHOUSE_PHONE') || '081234567890',
                        origin_address: this.configService.get<string>('WAREHOUSE_ADDRESS') || '',
                        origin_postal_code: this.configService.get<string>('WAREHOUSE_POSTAL_CODE') || '',
                        destination_contact_name: order.recipientName,
                        destination_contact_phone: order.recipientPhone,
                        destination_contact_email: order.user.email,
                        destination_address: order.shippingAddress,
                        destination_postal_code: order.shippingPostalCode,
                        destination_note: order.shippingNotes || '',
                        courier_company: order.biteshipCourier,
                        courier_type: order.biteshipService,
                        delivery_type: 'now',
                        order_note: `Order ${order.orderNumber}`,
                        items: biteshipItems,
                    };

                    // Create order in Biteship
                    const biteshipResponse = await this.biteshipService.createOrder(biteshipOrderRequest);

                    // Update order with Biteship data
                    updateData.biteshipOrderId = biteshipResponse.id;
                    updateData.trackingNumber = biteshipResponse.courier.tracking_id;

                    this.logger.info('✅ Biteship order created', {
                        orderNumber: order.orderNumber,
                        biteshipOrderId: biteshipResponse.id,
                        trackingNumber: biteshipResponse.courier.tracking_id,
                    });
                } catch (error: any) {
                    this.logger.error('❌ Failed to create Biteship order', {
                        orderNumber: order.orderNumber,
                        error: error.message,
                    });

                    throw new BadRequestException(
                        `Failed to create shipping order: ${error.message}. Please try again or contact support.`,
                    );
                }
            } else if (order.shippingType === 'INTERNATIONAL') {
                // For international orders, admin must input tracking manually
                if (!dto.tracking_number) {
                    throw new BadRequestException(
                        'Tracking number is required for international shipments',
                    );
                }
                updateData.trackingNumber = dto.tracking_number;
            }
        } else if (dto.status === 'DELIVERED') {
            updateData.deliveredAt = new Date();
        } else if (dto.status === 'COMPLETED') {
            updateData.completedAt = new Date();
        } else if (dto.status === 'CANCELLED') {
            updateData.canceledAt = new Date();

            // Restore stock if order was paid or processing
            if (['PAID', 'PROCESSING'].includes(order.status)) {
                await this.prisma.$transaction(async (tx) => {
                    for (const item of order.items) {
                        await tx.productVariant.update({
                            where: { id: item.variantId },
                            data: {
                                stock: {
                                    increment: item.quantity,
                                },
                            },
                        });
                    }
                });
            }
        }

        const updatedOrder = await this.prisma.order.update({
            where: { id: order.id },
            data: updateData,
        });

        this.logger.info(`📦 Order status updated: ${orderNumber}`, {
            from: order.status,
            to: dto.status,
        });

        return {
            message: 'Order status updated successfully',
            data: {
                id: updatedOrder.id,
                order_number: updatedOrder.orderNumber,
                status: updatedOrder.status,
                tracking_number: updatedOrder.trackingNumber,
                biteship_order_id: updatedOrder.biteshipOrderId,
                updated_at: updatedOrder.updatedAt,
            },
        };
    }

    /**
     * ✅ ENHANCED: Get tracking info with complete history
     */
    async getTrackingInfo(userId: string, orderNumber: string) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        if (!order.trackingNumber) {
            throw new BadRequestException('Order has not been shipped yet');
        }

        // For domestic orders with Biteship integration
        if (order.shippingType === 'DOMESTIC' && order.biteshipOrderId) {
            try {
                const tracking = await this.biteshipService.trackShipment(order.biteshipOrderId);

                return {
                    data: {
                        order_number: order.orderNumber,
                        tracking_number: order.trackingNumber,
                        courier: order.biteshipCourier,
                        service: order.biteshipService,
                        status: tracking.status,
                        history: tracking.history.map((h) => ({
                            status: h.status,
                            note: h.note,
                            date: h.updated_at,
                        })),
                        tracking_url: tracking.link,
                    },
                };
            } catch (error) {
                this.logger.error('Failed to get Biteship tracking', { error });
            }
        }

        // Fallback for international or if Biteship fails
        return {
            data: {
                order_number: order.orderNumber,
                tracking_number: order.trackingNumber,
                shipping_method: order.shippingMethod,
                status: order.status,
                shipped_at: order.shippedAt,
                delivered_at: order.deliveredAt,
            },
        };
    }

    /**
     * ✅ NEW: Get shipping label for order (Universal - works for both user and admin)
     */
    async getShippingLabel(orderNumber: string) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
            throw new BadRequestException('Order must be shipped to get shipping label');
        }

        if (!order.biteshipOrderId) {
            throw new BadRequestException('No Biteship order found for this shipment');
        }

        try {
            const labelUrl = await this.biteshipService.getShippingLabel(order.biteshipOrderId);

            return {
                data: {
                    order_number: order.orderNumber,
                    tracking_number: order.trackingNumber,
                    label_url: labelUrl,
                },
            };
        } catch (error: any) {
            this.logger.error('Failed to get shipping label', { error });
            throw new BadRequestException('Failed to retrieve shipping label');
        }
    }

    /**
     * ✅ NEW: Get shipping label for order (Admin version - alias for compatibility)
     */
    async getShippingLabelAdmin(orderNumber: string) {
        // Just call the universal method
        return this.getShippingLabel(orderNumber);
    }

    /**
     * ✅ NEW: Process Biteship webhook (called by webhook service)
     */
    async processBiteshipWebhook(biteshipOrderId: string, status: string, data: any) {
        this.logger.info('📦 Processing Biteship webhook', {
            biteshipOrderId,
            status,
        });

        const order = await this.prisma.order.findUnique({
            where: { biteshipOrderId },
        });

        if (!order) {
            this.logger.warn('⚠️ Biteship webhook: Order not found', { biteshipOrderId });
            return;
        }

        // Map Biteship status to our order status
        const statusMap: Record<string, string> = {
            'confirmed': 'SHIPPED',
            'allocated': 'SHIPPED',
            'picking_up': 'SHIPPED',
            'picked': 'SHIPPED',
            'dropping_off': 'SHIPPED',
            'delivered': 'DELIVERED',
            'cancelled': 'CANCELLED',
            'rejected': 'CANCELLED',
            'courier_not_found': 'CANCELLED',
            'returned': 'CANCELLED',
        };

        const newStatus = statusMap[status.toLowerCase()];

        if (!newStatus) {
            this.logger.warn('⚠️ Unknown Biteship status', { status });
            return;
        }

        // Only update if status is different and valid transition
        if (order.status !== newStatus) {
            const updateData: any = { status: newStatus };

            if (newStatus === 'DELIVERED') {
                updateData.deliveredAt = new Date();
            } else if (newStatus === 'CANCELLED') {
                updateData.canceledAt = new Date();
            }

            await this.prisma.order.update({
                where: { id: order.id },
                data: updateData,
            });

            this.logger.info('✅ Order status updated from webhook', {
                orderNumber: order.orderNumber,
                from: order.status,
                to: newStatus,
            });

            // TODO Phase 3: Send email notification to customer
        }
    }

    /**
     * ✅ NEW: Auto-complete delivered orders (called by cron)
     */
    async autoCompleteDeliveredOrders() {
        const autoCompleteDays = parseInt(
            this.configService.get<string>('ORDER_AUTO_COMPLETE_DAYS') || '3'
        );

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - autoCompleteDays);

        this.logger.info('⏰ Starting auto-complete for delivered orders', {
            cutoffDate,
            days: autoCompleteDays,
        });

        const orders = await this.prisma.order.findMany({
            where: {
                status: 'DELIVERED',
                deliveredAt: {
                    lte: cutoffDate,
                },
            },
        });

        if (orders.length === 0) {
            this.logger.info('✅ No orders to auto-complete');
            return { completed: 0 };
        }

        const orderIds = orders.map((o) => o.id);

        await this.prisma.order.updateMany({
            where: {
                id: { in: orderIds },
            },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        });

        this.logger.info(`✅ Auto-completed ${orders.length} orders`, {
            orderNumbers: orders.map((o) => o.orderNumber),
        });

        // TODO Phase 3: Send completion emails to customers

        return {
            completed: orders.length,
            orders: orders.map((o) => o.orderNumber),
        };
    }
}