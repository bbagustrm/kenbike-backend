// src/analytics/analytics.controller.ts

import {
    Controller,
    Get,
    Post,
    Query,
    Body,
    UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
    GetAnalyticsOverviewSchema,
    GetRevenueAnalyticsSchema,
    GetProductAnalyticsSchema,
    AiInsightQuerySchema,
} from './dto/analytics.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
    constructor(private analyticsService: AnalyticsService) {}

    /**
     * Get Dashboard Overview
     * GET /analytics/overview
     */
    @Get('overview')
    @Roles('ADMIN', 'OWNER')
    async getOverview(@Query() query: any) {
        const dto = GetAnalyticsOverviewSchema.parse(query);
        return this.analyticsService.getOverview(dto);
    }

    /**
     * Get Revenue Analytics
     * GET /analytics/revenue
     */
    @Get('revenue')
    @Roles('OWNER')
    async getRevenueAnalytics(@Query() query: any) {
        const dto = GetRevenueAnalyticsSchema.parse(query);
        return this.analyticsService.getRevenueAnalytics(dto);
    }

    /**
     * Get Order Status Distribution
     * GET /analytics/orders/status
     */
    @Get('orders/status')
    @Roles('ADMIN', 'OWNER')
    async getOrderStatusDistribution() {
        return this.analyticsService.getOrderStatusDistribution();
    }

    /**
     * Get Top Products
     * GET /analytics/products/top
     */
    @Get('products/top')
    @Roles('ADMIN', 'OWNER')
    async getTopProducts(@Query() query: any) {
        const dto = GetProductAnalyticsSchema.parse(query);
        return this.analyticsService.getTopProducts(dto);
    }

    /**
     * Get Recent Orders
     * GET /analytics/orders/recent
     */
    @Get('orders/recent')
    @Roles('ADMIN', 'OWNER')
    async getRecentOrders(@Query('limit') limit?: string) {
        return this.analyticsService.getRecentOrders(limit ? parseInt(limit) : 10);
    }

    /**
     * Get Low Stock Products
     * GET /analytics/products/low-stock
     */
    @Get('products/low-stock')
    @Roles('ADMIN', 'OWNER')
    async getLowStockProducts(
        @Query('threshold') threshold?: string,
        @Query('limit') limit?: string,
    ) {
        return this.analyticsService.getLowStockProducts(
            threshold ? parseInt(threshold) : 5,
            limit ? parseInt(limit) : 10,
        );
    }

    /**
     * Get Promotion Performance (Owner only)
     * GET /analytics/promotions
     */
    @Get('promotions')
    @Roles('OWNER')
    async getPromotionPerformance() {
        return this.analyticsService.getPromotionPerformance();
    }

    /**
     * Get AI Insights (Owner only)
     * POST /analytics/ai-insights
     */
    @Post('ai-insights')
    @Roles('OWNER')
    async getAiInsights(@Body() body: any) {
        const dto = AiInsightQuerySchema.parse(body);
        return this.analyticsService.getAiInsights(dto);
    }

    /**
     * Get Quick AI Summary (Owner only)
     * GET /analytics/ai-summary
     */
    @Get('ai-summary')
    @Roles('OWNER')
    async getQuickAiSummary() {
        return this.analyticsService.getQuickAiSummary();
    }
}