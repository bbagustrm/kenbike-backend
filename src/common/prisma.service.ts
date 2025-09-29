import {Global, Inject, Injectable, OnModuleInit} from "@nestjs/common";
import {Logger} from "winston";
import {PrismaClient} from "@prisma/client";
import {WINSTON_MODULE_NEST_PROVIDER} from "nest-winston";

@Global()
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit{
    constructor(
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger,
    ){
        super({
            log: [
                {
                    emit: 'event',
                    level: 'info',
                },
                {
                    emit: 'event',
                    level: 'warn',
                },
                {
                    emit: 'event',
                    level: 'error',
                },
                {
                    emit: 'event',
                    level: 'query',
                },
            ]
        })
    }

    async onModuleInit() {
        // Setup event listeners
        this.$on('info', (e) => {
            this.logger.info('Prisma Info:', e);
        });

        this.$on('warn', (e) => {
            this.logger.warn('Prisma Warning:', e);
        });

        this.$on('error', (e) => {
            this.logger.error('Prisma Error:', e);
        });

        this.$on('query', (e) => {
            this.logger.info('Prisma Query:', {
                query: e.query,
                params: e.params,
                duration: `${e.duration}ms`,
                target: e.target
            });
        });

        // Connect to database
        try {
            await this.$connect();
            this.logger.info('Successfully connected to database');
        } catch (error) {
            this.logger.error('Failed to connect to database:', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            await this.$disconnect();
            this.logger.info('Successfully disconnected from database');
        } catch (error) {
            this.logger.error('Error disconnecting from database:', error);
        }
    }
}