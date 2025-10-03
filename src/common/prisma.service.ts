import { Global, Inject, Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Logger } from "winston";
import { PrismaClient } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";

@Global()
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.info("✅ Successfully connected to database");
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
}
