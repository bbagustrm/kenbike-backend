import { Global, Inject, Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Logger } from "winston";
import { PrismaClient } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";

// Simple query stats tracker (Prisma v6 compatible)
class QueryStatsTracker {
    private stats = {
        total: 0,
        read: 0,
        write: 0,
        totalTime: 0,
    };

    increment(type: 'read' | 'write', duration: number) {
        this.stats.total++;
        this.stats[type]++;
        this.stats.totalTime += duration;
    }

    getStats() {
        const avgQueryTime = this.stats.total > 0
            ? (this.stats.totalTime / this.stats.total).toFixed(2)
            : '0.00';

        return {
            total: this.stats.total,
            read: this.stats.read,
            write: this.stats.write,
            totalTime: this.stats.totalTime,
            avgQueryTime: `${avgQueryTime}ms`,
        };
    }

    resetStats() {
        this.stats = {
            total: 0,
            read: 0,
            write: 0,
            totalTime: 0,
        };
    }
}

@Global()
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private queryTracker: QueryStatsTracker;

    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        super({
            log: [
                { emit: "stdout", level: "query" },
                { emit: "stdout", level: "info" },
                { emit: "stdout", level: "warn" },
                { emit: "stdout", level: "error" },
            ],
        });

        // Initialize query tracking
        this.queryTracker = new QueryStatsTracker();
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.info("✅ Successfully connected to database");

            // Note: Prisma v6 removed $use middleware API
            // Query tracking is now simplified using internal counter
            this.logger.info("✅ Query tracking initialized (Prisma v6 compatible)");
        } catch (error) {
            this.logger.error("❌ Failed to connect to database:", error);
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            await this.$disconnect();
            this.logger.info("✅ Successfully disconnected from database");
        } catch (error) {
            this.logger.error("❌ Error disconnecting from database:", error);
        }
    }

    /**
     * Get query statistics
     * Note: Simplified version for Prisma v6
     */
    getQueryStats() {
        return this.queryTracker.getStats();
    }

    /**
     * Reset query statistics
     */
    resetQueryStats() {
        this.queryTracker.resetStats();
    }

    /**
     * Track a query (call this manually in services if needed)
     */
    trackQuery(type: 'read' | 'write', duration: number) {
        this.queryTracker.increment(type, duration);
    }
}