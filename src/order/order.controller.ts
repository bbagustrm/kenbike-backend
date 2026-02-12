// ORDER CONTROLLER - src/order/order.controller.ts

import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
    CalculateShippingSchema,
    CalculateShippingDto,
} from './dto/calculate-shipping.dto';
import {
    CreateOrderSchema,
    CreateOrderDto,
} from './dto/create-order.dto';
import {
    GetOrdersSchema,
    GetOrdersDto,
    CancelOrderSchema,
    CancelOrderDto,
} from './dto/order-management.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
    constructor(
        private orderService: OrderService,
        private validationService: ValidationService,
    ) {}

    /**
     * POST /orders/calculate-shipping
     * Calculate shipping options
     */
    @Post('calculate-shipping')
    async calculateShipping(
        @CurrentUser('id') userId: string,
        @Body() body: any,
    ) {
        const dto = this.validationService.validate<CalculateShippingDto>(
            CalculateShippingSchema,
            body,
        );

        return this.orderService.calculateShipping(userId, dto);
    }

    /**
     * POST /orders
     * Create order from cart
     */
    @Post()
    async createOrder(
        @CurrentUser('id') userId: string,
        @Body() body: any,
    ) {
        const dto = this.validationService.validate<CreateOrderDto>(
            CreateOrderSchema,
            body,
        );

        return this.orderService.createOrder(userId, dto);
    }

    /**
     * GET /orders
     * Get user's orders
     */
    @Get()
    async getUserOrders(
        @CurrentUser('id') userId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('sort_by') sort_by?: string,
        @Query('order') order?: string,
        @Query('search') search?: string,
    ) {
        const dto = this.validationService.validate<GetOrdersDto>(
            GetOrdersSchema,
            {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                status: status as any,
                sort_by: (sort_by || 'created_at') as any,
                order: (order || 'desc') as any,
                search,
            },
        );

        return this.orderService.getUserOrders(userId, dto);
    }

    /**
     * GET /orders/:orderNumber
     * Get order detail
     */
    @Get(':orderNumber')
    async getOrderDetail(
        @CurrentUser('id') userId: string,
        @Param('orderNumber') orderNumber: string,
    ) {
        return this.orderService.getOrderDetail(userId, orderNumber);
    }

    /**
     * POST /orders/:orderNumber/cancel
     * Cancel order
     */
    @Post(':orderNumber/cancel')
    async cancelOrder(
        @CurrentUser('id') userId: string,
        @Param('orderNumber') orderNumber: string,
        @Body() body: any,
    ) {
        const dto = this.validationService.validate<CancelOrderDto>(
            CancelOrderSchema,
            body,
        );

        return this.orderService.cancelOrder(userId, orderNumber, dto);
    }

    /**
     * POST /orders/:orderNumber/confirm-delivery
     * User confirms they received the order (DELIVERED -> COMPLETED)
     */
    @Post(':orderNumber/confirm-delivery')
    async confirmDelivery(
        @CurrentUser('id') userId: string,
        @Param('orderNumber') orderNumber: string,
    ) {
        return this.orderService.confirmDelivery(userId, orderNumber);
    }


    /**
     * GET /orders/:orderNumber/tracking
     * Get tracking info
     */
    @Get(':orderNumber/tracking')
    async getTrackingInfo(
        @CurrentUser('id') userId: string,
        @Param('orderNumber') orderNumber: string,
    ) {
        return this.orderService.getTrackingInfo(userId, orderNumber);
    }

    /**
     * ✅ NEW: GET /orders/:orderNumber/shipping-label
     * Get shipping label URL
     */
    @Get(':orderNumber/shipping-label')
    async getShippingLabel(
        @CurrentUser('id') userId: string,
        @Param('orderNumber') orderNumber: string,
    ) {
        // First verify user owns the order
        await this.orderService.getOrderDetail(userId, orderNumber);

        // Then get shipping label
        return this.orderService.getShippingLabel(orderNumber);
    }

}