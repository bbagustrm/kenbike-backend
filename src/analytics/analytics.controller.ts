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
     * Get cache statistics (from RedisService internal tracker)
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
     * Get database query statistics (from Prisma middleware tracker)
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
     * Get combined performance metrics (cache + DB)
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

    // ==========================================
    // pg_stat_statements - PostgreSQL Native Query Stats
    // (For thesis: measures actual DB query load reduction)
    // ==========================================

    /**
     * Get top queries from pg_stat_statements
     * Useful to measure DB query load BEFORE vs AFTER Redis
     *
     * Prerequisites: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
     *
     * GET /api/v1/analytics/database/pg-stats
     * Query params:
     *   - limit: number of queries to return (default: 20)
     *   - minCalls: minimum call count to include (default: 5)
     */
    @Get('database/pg-stats')
    @Roles('ADMIN', 'OWNER')
    async getPgStatStatements(
        @Query('limit') limit?: string,
        @Query('minCalls') minCalls?: string,
    ) {
        try {
            const queryLimit = limit ? parseInt(limit) : 20;
            const minCallsFilter = minCalls ? parseInt(minCalls) : 5;

            const stats = await this.prismaService.$queryRaw<any[]>`
                SELECT 
                    calls,
                    ROUND(mean_exec_time::numeric, 2)   AS avg_time_ms,
                    ROUND(max_exec_time::numeric, 2)    AS max_time_ms,
                    ROUND(min_exec_time::numeric, 2)    AS min_time_ms,
                    ROUND(total_exec_time::numeric, 2)  AS total_time_ms,
                    ROUND(stddev_exec_time::numeric, 2) AS stddev_ms,
                    rows,
                    LEFT(query, 120)                     AS query_preview
                FROM pg_stat_statements
                WHERE 
                    query NOT LIKE '%pg_stat_statements%'
                    AND query NOT LIKE '%information_schema%'
                    AND calls >= ${minCallsFilter}
                ORDER BY calls DESC
                LIMIT ${queryLimit}
            `;

            // Also get summary totals
            const summary = await this.prismaService.$queryRaw<any[]>`
                SELECT
                    COUNT(*)                                AS total_unique_queries,
                    SUM(calls)                              AS total_calls,
                    ROUND(SUM(total_exec_time)::numeric, 2) AS total_exec_time_ms,
                    ROUND(AVG(mean_exec_time)::numeric, 2)  AS overall_avg_ms
                FROM pg_stat_statements
                WHERE 
                    query NOT LIKE '%pg_stat_statements%'
                    AND query NOT LIKE '%information_schema%'
            `;

            return {
                success: true,
                data: {
                    summary: summary[0] || {},
                    queries: stats,
                },
                meta: {
                    limit: queryLimit,
                    minCalls: minCallsFilter,
                    note: 'Use POST /analytics/database/pg-stats/reset to clear stats before each test run',
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            // pg_stat_statements extension not installed
            if (error.message?.includes('pg_stat_statements')) {
                return {
                    success: false,
                    error: 'pg_stat_statements extension not installed',
                    fix: 'Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements; in PostgreSQL',
                    timestamp: new Date().toISOString(),
                };
            }
            throw error;
        }
    }

    /**
     * Reset pg_stat_statements counters
     * Call this BEFORE each JMeter test run for clean measurements
     *
     * POST /api/v1/analytics/database/pg-stats/reset
     */
    @Post('database/pg-stats/reset')
    @Roles('ADMIN', 'OWNER')
    async resetPgStatStatements() {
        try {
            await this.prismaService.$queryRaw`SELECT pg_stat_statements_reset()`;
            return {
                success: true,
                message: 'pg_stat_statements counters reset successfully',
                note: 'All query call counts and timing data have been cleared',
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            if (error.message?.includes('pg_stat_statements')) {
                return {
                    success: false,
                    error: 'pg_stat_statements extension not installed',
                    fix: 'Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements; in PostgreSQL',
                };
            }
            throw error;
        }
    }

    /**
     * Get Redis server info (raw stats from Redis INFO command)
     * GET /api/v1/analytics/cache/redis-info
     */
    @Get('cache/redis-info')
    @Roles('ADMIN', 'OWNER')
    async getRedisInfo() {
        const info = await this.redisService.getInfo();

        if (!info) {
            return {
                success: false,
                message: 'Redis not connected or caching disabled',
            };
        }

        // Parse relevant keyspace_hits/misses from raw INFO output
        const lines = info.split('\r\n');
        const parsed: Record<string, string> = {};

        const relevantKeys = [
            'redis_version',
            'uptime_in_seconds',
            'used_memory_human',
            'used_memory_peak_human',
            'keyspace_hits',
            'keyspace_misses',
            'total_commands_processed',
            'instantaneous_ops_per_sec',
            'connected_clients',
            'expired_keys',
            'evicted_keys',
            'total_keys_processed',
        ];

        for (const line of lines) {
            const [key, value] = line.split(':');
            if (key && value && relevantKeys.includes(key.trim())) {
                parsed[key.trim()] = value.trim();
            }
        }

        // Calculate Redis-native hit rate
        const hits = parseInt(parsed['keyspace_hits'] || '0');
        const misses = parseInt(parsed['keyspace_misses'] || '0');
        const total = hits + misses;
        const nativeHitRate = total > 0 ? ((hits / total) * 100).toFixed(2) + '%' : 'N/A';

        return {
            success: true,
            data: {
                ...parsed,
                // Computed fields
                native_hit_rate: nativeHitRate,
                // Application-level stats (from our tracker)
                app_stats: this.redisService.getStats(),
            },
            note: 'keyspace_hits/misses are Redis-native counters. app_stats are application-level counters reset with POST /cache/stats/reset',
            timestamp: new Date().toISOString(),
        };
    }
}