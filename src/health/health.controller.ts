import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, PrismaHealthIndicator } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { RedisHealthIndicator } from '../common/redis/redis.health';
import { PrismaService } from '../common/prisma.service';

/**
 * Health Check Controller
 *
 * Provides health status endpoints for:
 * - Overall system health
 * - Database (PostgreSQL) health
 * - Cache (Redis) health
 */
@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: PrismaHealthIndicator,
        private redis: RedisHealthIndicator,
        private prisma: PrismaService,
    ) {}

    /**
     * Main health check endpoint
     * GET /api/v1/health
     */
    @Get()
    @Public()
    @HealthCheck()
    check() {
        return this.health.check([
            // PostgreSQL health check
            () => this.db.pingCheck('database', this.prisma as any),

            // Redis health check
            () => this.redis.isHealthy('redis'),
        ]);
    }

    /**
     * Database-only health check
     * GET /api/v1/health/db
     */
    @Get('db')
    @Public()
    @HealthCheck()
    checkDatabase() {
        return this.health.check([
            () => this.db.pingCheck('database', this.prisma as any),
        ]);
    }

    /**
     * Redis-only health check
     * GET /api/v1/health/redis
     */
    @Get('redis')
    @Public()
    @HealthCheck()
    checkRedis() {
        return this.health.check([
            () => this.redis.isHealthy('redis'),
        ]);
    }
}