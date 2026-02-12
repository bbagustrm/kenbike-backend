import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from './redis.service';

/**
 * Redis Health Indicator
 *
 * Checks Redis connection status for health endpoint
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor(private redisService: RedisService) {
        super();
    }

    /**
     * Check Redis health
     */
    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            // Try to set and get a test key
            const testKey = 'health:check:redis';
            const testValue = Date.now().toString();

            await this.redisService.set(testKey, testValue, 5); // 5 seconds TTL
            const retrievedValue = await this.redisService.get(testKey);

            if (retrievedValue === testValue) {
                return this.getStatus(key, true, {
                    status: 'up',
                    message: 'Redis is healthy',
                });
            }

            throw new Error('Redis read/write test failed');
        } catch (error) {
            throw new HealthCheckError(
                'Redis health check failed',
                this.getStatus(key, false, {
                    status: 'down',
                    message: error.message,
                }),
            );
        }
    }
}