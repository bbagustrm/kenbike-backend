import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from './redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor(private readonly redisService: RedisService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        if (!this.redisService.isEnabled) {
            return this.getStatus(key, true, {
                status: 'disabled',
                message: 'Redis caching is disabled (ENABLE_CACHE=false)',
            });
        }

        if (!this.redisService.isCacheEnabled()) {
            return this.getStatus(key, true, {
                status: 'connecting',
                message: 'Redis is enabled but not yet ready — fallback to database active',
            });
        }

        try {
            const isAlive = await this.redisService.ping();

            if (isAlive) {
                return this.getStatus(key, true, {
                    status: 'up',
                    message: 'Redis is healthy',
                });
            }

            throw new Error('Redis ping returned unexpected response');
        } catch (error) {
            throw new HealthCheckError(
                'Redis read/write test failed',
                this.getStatus(key, false, {
                    status: 'down',
                    message: error instanceof Error ? error.message : 'Unknown error',
                }),
            );
        }
    }
}