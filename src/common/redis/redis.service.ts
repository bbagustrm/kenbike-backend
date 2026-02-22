import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);

    public readonly isEnabled: boolean;
    private client: Redis | null = null;

    private stats = {
        hits: 0,
        misses: 0,
    };

    constructor(private configService: ConfigService) {
        const enableCache = this.configService.get<string>('ENABLE_CACHE', 'true');
        this.isEnabled = enableCache !== 'false';
    }

    async onModuleInit() {
        if (!this.isEnabled) {
            this.logger.warn('⚠️  Redis caching is DISABLED - running in database-only mode (fallback active)');
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
                    if (times <= 10) {
                        const delay = Math.min(times * 500, 5000);
                        this.logger.warn(`🔄 Redis retry attempt ${times}/10 in ${delay}ms...`);
                        return delay;
                    }
                    this.logger.warn('⚠️  Redis degraded mode — retrying every 30s. Fallback to database active.');
                    return 30000;
                },
                lazyConnect: true,
            });

            await this.client.connect();

            this.client.on('connect', () => {
                this.logger.log(`✅ Redis connected to ${redisHost}:${redisPort}`);
            });

            this.client.on('ready', () => {
                this.logger.log('✅ Redis is ready');
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
            this.logger.warn('⚠️  Cache fallback active — all requests will use database');
            this.client = null;
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
            this.logger.log('✅ Redis connection closed');
        }
    }

    async ping(): Promise<boolean> {
        if (!this.isEnabled || !this.client) return false;
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        } catch {
            return false;
        }
    }

    isCacheEnabled(): boolean {
        return this.isEnabled && this.client?.status === 'ready';
    }

    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            total,
            hitRate: hitRate.toFixed(2) + '%',
            isConnected: this.client?.status === 'ready',
            isEnabled: this.isEnabled,
        };
    }

    resetStats() {
        this.stats.hits = 0;
        this.stats.misses = 0;
        this.logger.log('📊 Cache statistics reset');
    }

    async get<T>(key: string): Promise<T | null> {
        // ✅ Fallback logging saat cache disabled
        if (!this.isEnabled) {
            this.logger.debug('Cache skipped: Redis is disabled. Running without cache.');
            return null;
        }

        if (!this.client || this.client.status !== 'ready') {
            this.logger.warn('Cache skipped: Redis not ready.');
            this.stats.misses++;
            return null;
        }

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

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        if (!this.isEnabled) return;

        if (!this.client || this.client.status !== 'ready') {
            this.logger.warn('Cache skipped: Redis not ready.');
            return;
        }

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

    async del(key: string): Promise<void> {
        if (!this.isEnabled || !this.client) return;
        try {
            await this.client.del(key);
            this.logger.debug(`🗑️  Cache DEL: ${key}`);
        } catch (error) {
            this.logger.error(`❌ Error deleting cache key "${key}":`, error);
        }
    }

    async delByPattern(pattern: string): Promise<number> {
        if (!this.isEnabled || !this.client) return 0;
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length === 0) return 0;
            await this.client.del(...keys);
            this.logger.log(`🗑️  Deleted ${keys.length} keys matching pattern: ${pattern}`);
            return keys.length;
        } catch (error) {
            this.logger.error(`❌ Error deleting cache pattern "${pattern}":`, error);
            return 0;
        }
    }

    async reset(): Promise<void> {
        if (!this.isEnabled || !this.client) return;
        try {
            await this.client.flushdb();
            this.logger.warn('🗑️  Cache RESET: All keys deleted');
        } catch (error) {
            this.logger.error('❌ Error resetting cache:', error);
        }
    }

    async incr(key: string): Promise<number> {
        if (!this.isEnabled || !this.client) return 0;
        try {
            return await this.client.incr(key);
        } catch (error) {
            this.logger.error(`❌ Error incrementing cache key "${key}":`, error);
            return 0;
        }
    }

    getTTL(dataType: 'products' | 'product_list' | 'categories' | 'tags' | 'promotions'): number {
        const ttlMap = {
            products: this.configService.get<number>('CACHE_TTL_PRODUCTS', 300),
            product_list: this.configService.get<number>('CACHE_TTL_PRODUCT_LIST', 180),
            categories: this.configService.get<number>('CACHE_TTL_CATEGORIES', 600),
            tags: this.configService.get<number>('CACHE_TTL_TAGS', 600),
            promotions: this.configService.get<number>('CACHE_TTL_PROMOTIONS', 300),
        };
        return ttlMap[dataType];
    }

    buildKey(prefix: string, ...parts: (string | number)[]): string {
        return `${prefix}:${parts.join(':')}`;
    }

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