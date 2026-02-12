import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis Service
 *
 * Direct implementation using ioredis for better compatibility
 * Provides centralized caching operations with:
 * - Error handling and fallback
 * - Cache statistics tracking
 * - Pattern-based cache invalidation
 * - TTL management per data type
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private readonly isEnabled: boolean;
    private client: Redis | null = null;

    // Cache hit/miss statistics
    private stats = {
        hits: 0,
        misses: 0,
    };

    constructor(private configService: ConfigService) {
        this.isEnabled = this.configService.get<boolean>('ENABLE_CACHE', true);
    }

    /**
     * Initialize Redis connection
     */
    async onModuleInit() {
        if (!this.isEnabled) {
            this.logger.warn('⚠️  Redis caching is DISABLED');
            return;
        }

        try {
            const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
            const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
            const redisPassword = this.configService.get<string>('REDIS_PASSWORD', '');
            const redisDb = this.configService.get<number>('REDIS_DB', 0);

            this.client = new Redis({
                host: redisHost,
                port: redisPort,
                password: redisPassword || undefined,
                db: redisDb,
                connectTimeout: 10000,
                maxRetriesPerRequest: 3,
                retryStrategy: (times: number) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                lazyConnect: true,
            });

            // Connect to Redis
            await this.client.connect();

            // Event handlers
            this.client.on('connect', () => {
                this.logger.log(`✅ Redis connected to ${redisHost}:${redisPort}`);
            });

            this.client.on('error', (error) => {
                this.logger.error('❌ Redis connection error:', error);
            });

            this.client.on('reconnecting', () => {
                this.logger.warn('🔄 Redis reconnecting...');
            });

            this.logger.log('✅ Redis service initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Redis:', error);
            this.client = null;
        }
    }

    /**
     * Close Redis connection
     */
    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
            this.logger.log('✅ Redis connection closed');
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            total,
            hitRate: hitRate.toFixed(2) + '%',
            isConnected: this.client?.status === 'ready',
        };
    }

    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats.hits = 0;
        this.stats.misses = 0;
        this.logger.log('📊 Cache statistics reset');
    }

    /**
     * Get value from cache
     *
     * @param key Cache key
     * @returns Cached value or null
     */
    async get<T>(key: string): Promise<T | null> {
        if (!this.isEnabled || !this.client) return null;

        try {
            const value = await this.client.get(key);

            if (value) {
                this.stats.hits++;
                this.logger.debug(`✅ Cache HIT: ${key}`);
                return JSON.parse(value) as T;
            } else {
                this.stats.misses++;
                this.logger.debug(`❌ Cache MISS: ${key}`);
                return null;
            }
        } catch (error) {
            this.logger.error(`❌ Error getting cache key "${key}":`, error);
            this.stats.misses++;
            return null;
        }
    }

    /**
     * Set value in cache
     *
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Time to live in seconds (optional)
     */
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        if (!this.isEnabled || !this.client) return;

        try {
            const serialized = JSON.stringify(value);

            if (ttl && ttl > 0) {
                await this.client.setex(key, ttl, serialized);
            } else {
                await this.client.set(key, serialized);
            }

            this.logger.debug(`✅ Cache SET: ${key} (TTL: ${ttl || 'none'}s)`);
        } catch (error) {
            this.logger.error(`❌ Error setting cache key "${key}":`, error);
        }
    }

    /**
     * Delete specific cache key
     *
     * @param key Cache key to delete
     */
    async del(key: string): Promise<void> {
        if (!this.isEnabled || !this.client) return;

        try {
            await this.client.del(key);
            this.logger.debug(`🗑️  Cache DEL: ${key}`);
        } catch (error) {
            this.logger.error(`❌ Error deleting cache key "${key}":`, error);
        }
    }

    /**
     * Delete multiple cache keys by pattern
     *
     * @param pattern Cache key pattern (e.g., "products:*")
     */
    async delByPattern(pattern: string): Promise<number> {
        if (!this.isEnabled || !this.client) return 0;

        try {
            const keys = await this.client.keys(pattern);

            if (keys.length === 0) {
                this.logger.debug(`🔍 No keys found matching pattern: ${pattern}`);
                return 0;
            }

            await this.client.del(...keys);

            this.logger.log(`🗑️  Deleted ${keys.length} keys matching pattern: ${pattern}`);
            return keys.length;
        } catch (error) {
            this.logger.error(`❌ Error deleting cache pattern "${pattern}":`, error);
            return 0;
        }
    }

    /**
     * Clear all cache
     */
    async reset(): Promise<void> {
        if (!this.isEnabled || !this.client) return;

        try {
            await this.client.flushdb();
            this.logger.warn('🗑️  Cache RESET: All keys deleted');
        } catch (error) {
            this.logger.error('❌ Error resetting cache:', error);
        }
    }

    /**
     * Increment counter (for view counter, etc)
     */
    async incr(key: string): Promise<number> {
        if (!this.isEnabled || !this.client) return 0;

        try {
            const value = await this.client.incr(key);
            this.logger.debug(`➕ Cache INCR: ${key} = ${value}`);
            return value;
        } catch (error) {
            this.logger.error(`❌ Error incrementing cache key "${key}":`, error);
            return 0;
        }
    }

    /**
     * Get TTL for specific data type
     */
    getTTL(dataType: 'products' | 'product_list' | 'categories' | 'notifications'): number {
        const ttlMap = {
            products: this.configService.get<number>('CACHE_TTL_PRODUCTS', 300),
            product_list: this.configService.get<number>('CACHE_TTL_PRODUCT_LIST', 180),
            categories: this.configService.get<number>('CACHE_TTL_CATEGORIES', 600),
            notifications: this.configService.get<number>('CACHE_TTL_NOTIFICATIONS', 0),
        };

        return ttlMap[dataType];
    }

    /**
     * Build cache key with consistent format
     */
    buildKey(prefix: string, ...parts: (string | number)[]): string {
        return `${prefix}:${parts.join(':')}`;
    }

    /**
     * Check if caching is enabled
     */
    isCacheEnabled(): boolean {
        return this.isEnabled && this.client?.status === 'ready';
    }

    /**
     * Get Redis info
     */
    async getInfo(): Promise<string | null> {
        if (!this.client) return null;

        try {
            return await this.client.info();
        } catch (error) {
            this.logger.error('❌ Error getting Redis info:', error);
            return null;
        }
    }
}