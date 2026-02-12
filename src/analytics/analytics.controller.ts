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
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../common/prisma.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
    constructor(
        private analyticsService: AnalyticsService,
        private redisService: RedisService,
        private prismaService: PrismaService,
    ) {}

    // ==========================================
    // EXISTING ANALYTICS ENDPOINTS
    // ==========================================

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

    // ==========================================
    // REDIS & DATABASE PERFORMANCE MONITORING
    // ==========================================

    /**
     * Get cache statistics
     * GET /api/v1/analytics/cache/stats
     */
    @Get('cache/stats')
    @Roles('ADMIN', 'OWNER')
    getCacheStats() {
        return {
            success: true,
            data: this.redisService.getStats(),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Reset cache statistics
     * POST /api/v1/analytics/cache/stats/reset
     */
    @Post('cache/stats/reset')
    @Roles('ADMIN', 'OWNER')
    resetCacheStats() {
        this.redisService.resetStats();
        return {
            success: true,
            message: 'Cache statistics reset successfully',
        };
    }

    /**
     * Get database query statistics
     * GET /api/v1/analytics/database/stats
     */
    @Get('database/stats')
    @Roles('ADMIN', 'OWNER')
    getDatabaseStats() {
        return {
            success: true,
            data: this.prismaService.getQueryStats(),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Reset database query statistics
     * POST /api/v1/analytics/database/stats/reset
     */
    @Post('database/stats/reset')
    @Roles('ADMIN', 'OWNER')
    resetDatabaseStats() {
        this.prismaService.resetQueryStats();
        return {
            success: true,
            message: 'Database statistics reset successfully',
        };
    }

    /**
     * Get combined performance metrics
     * GET /api/v1/analytics/performance
     */
    @Get('performance')
    @Roles('ADMIN', 'OWNER')
    getPerformanceMetrics() {
        const cacheStats = this.redisService.getStats();
        const dbStats = this.prismaService.getQueryStats();

        return {
            success: true,
            data: {
                cache: cacheStats,
                database: dbStats,
                cacheEnabled: this.redisService.isCacheEnabled(),
            },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Clear all cache
     * POST /api/v1/analytics/cache/clear
     */
    @Post('cache/clear')
    @Roles('OWNER')
    async clearCache() {
        await this.redisService.reset();
        return {
            success: true,
            message: 'All cache cleared successfully',
        };
    }
}