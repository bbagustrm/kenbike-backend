// src/order/admin-order.controller.ts

import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderExpiryCron } from './cron/order-expiry.cron';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
    GetAllOrdersSchema,
    GetAllOrdersDto,
    UpdateOrderStatusSchema,
    UpdateOrderStatusDto,
} from './dto/order-management.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'OWNER')
export class AdminOrderController {
    constructor(
        private orderService: OrderService,
        private orderExpiryCron: OrderExpiryCron,
        private validationService: ValidationService,
    ) {}

    /**
     * POST /admin/orders/cron/auto-complete
     * Manual trigger for auto-complete cron job
     */
    @Post('cron/auto-complete')
    async manualAutoComplete() {
        const result = await this.orderService.autoCompleteDeliveredOrders();

        return {
            message: 'Auto-complete triggered successfully',
            data: result,
        };
    }

    /**
     * POST /admin/orders/cron/cancel-expired
     * Manual trigger for order expiry cron job
     */
    @Post('cron/cancel-expired')
    async manualCancelExpired() {
        const result = await this.orderExpiryCron.triggerManually();

        return {
            message: 'Order expiry check triggered successfully',
            data: result,
        };
    }

    /**
     * GET /admin/orders/pending/without-payment
     * Get PENDING orders that need attention (older than 1 hour)
     */
    @Get('pending/without-payment')
    async getPendingOrders() {
        return {
            message: 'Feature coming soon',
            data: [],
        };
    }

    /**
     * GET /admin/orders/paid/without-tracking
     * Get PAID orders without tracking number (Biteship creation failed)
     */
    @Get('paid/without-tracking')
    async getPaidOrdersWithoutTracking() {
        return {
            message: 'Feature coming soon',
            data: [],
        };
    }

    /**
     * GET /admin/orders
     * Get all orders with filters
     */
    @Get()
    async getAllOrders(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('user_id') user_id?: string,
        @Query('payment_method') payment_method?: string,
        @Query('shipping_type') shipping_type?: string,
        @Query('date_from') date_from?: string,
        @Query('date_to') date_to?: string,
        @Query('sort_by') sort_by?: string,
        @Query('order') order?: string,
        @Query('search') search?: string,
    ) {
        const dto = this.validationService.validate<GetAllOrdersDto>(
            GetAllOrdersSchema,
            {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                status: status as any,
                user_id,
                payment_method: payment_method as any,
                shipping_type: shipping_type as any,
                date_from,
                date_to,
                sort_by: (sort_by || 'created_at') as any,
                order: (order || 'desc') as any,
                search,
            },
        );

        return this.orderService.getAllOrders(dto);
    }

    /**
     * GET /admin/orders/:orderNumber
     * Get order detail (admin view)
     */
    @Get(':orderNumber')
    async getOrderDetail(
        @Param('orderNumber') orderNumber: string,
    ) {
        return this.orderService.getOrderDetailAdmin(orderNumber);
    }

    /**
     * GET /admin/orders/:orderNumber/tracking
     * Get tracking info (admin view - no ownership check)
     */
    @Get(':orderNumber/tracking')
    async getTrackingInfo(
        @Param('orderNumber') orderNumber: string,
    ) {
        return this.orderService.getTrackingInfoAdmin(orderNumber);
    }

    /**
     * PATCH /admin/orders/:orderNumber/status
     * Update order status
     */
    @Patch(':orderNumber/status')
    async updateOrderStatus(
        @Param('orderNumber') orderNumber: string,
        @Body() body: any,
    ) {
        const dto = this.validationService.validate<UpdateOrderStatusDto>(
            UpdateOrderStatusSchema,
            body,
        );

        return this.orderService.updateOrderStatus(orderNumber, dto);
    }

    /**
     * GET /admin/orders/:orderNumber/shipping-label
     * Get shipping label URL
     */
    @Get(':orderNumber/shipping-label')
    async getShippingLabel(
        @Param('orderNumber') orderNumber: string,
    ) {
        return this.orderService.getShippingLabelAdmin(orderNumber);
    }

    /**
     * POST /admin/orders/:orderNumber/retry-biteship
     * Retry Biteship order creation (for failed/missing shipping orders)
     */
    @Post(':orderNumber/retry-biteship')
    async retryBiteshipCreation(
        @Param('orderNumber') orderNumber: string,
    ) {
        return this.orderService.retryBiteshipCreation(orderNumber);
    }
}