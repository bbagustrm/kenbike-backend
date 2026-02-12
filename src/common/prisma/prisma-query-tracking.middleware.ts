import { Injectable, Logger } from '@nestjs/common';

/**
 * Prisma Query Tracking Middleware
 *
 * Tracks database queries for performance analysis:
 * - Query count per request
 * - Query execution time
 * - Query types (read/write)
 *
 * Used for measuring cache effectiveness
 */
@Injectable()
export class PrismaQueryTrackingMiddleware {
    private readonly logger = new Logger(PrismaQueryTrackingMiddleware.name);

    // Statistics
    private queryStats = {
        total: 0,
        read: 0,
        write: 0,
        totalTime: 0,
    };

    /**
     * Create middleware function
     */
    createMiddleware() {
        return async (params: any, next: any) => {
            const before = Date.now();
            const result = await next(params);
            const after = Date.now();
            const duration = after - before;

            // Track query
            this.trackQuery(params, duration);

            return result;
        };
    }

    /**
     * Track individual query
     */
    private trackQuery(params: any, duration: number) {
        this.queryStats.total++;
        this.queryStats.totalTime += duration;

        // Categorize query type
        const readOperations = ['findMany', 'findUnique', 'findFirst', 'count', 'aggregate'];
        const writeOperations = ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'];

        if (readOperations.includes(params.action)) {
            this.queryStats.read++;
        } else if (writeOperations.includes(params.action)) {
            this.queryStats.write++;
        }

        // Log slow queries (> 100ms)
        if (duration > 100) {
            this.logger.warn(
                `🐌 Slow query detected: ${params.model}.${params.action} took ${duration}ms`
            );
        }
    }

    /**
     * Get query statistics
     */
    getStats() {
        return {
            ...this.queryStats,
            avgQueryTime: this.queryStats.total > 0
                ? (this.queryStats.totalTime / this.queryStats.total).toFixed(2) + 'ms'
                : '0ms',
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.queryStats = {
            total: 0,
            read: 0,
            write: 0,
            totalTime: 0,
        };
        this.logger.log('📊 Query statistics reset');
    }
}