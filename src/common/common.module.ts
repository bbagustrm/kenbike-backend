import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ValidationService } from './validation.service';
import { PrismaService } from './prisma.service';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { BlacklistTokenMiddleware } from './middleware/blacklist-token.middleware';
import { DDoSProtectionMiddleware } from './middleware/ddos-protection.middleware';
import appConfig from '../config/app.config';
import jwtConfig from '../config/jwt.config';
import databaseConfig from '../config/database.config';

@Global()
@Module({
    imports: [
        WinstonModule.forRoot({
            format: winston.format.json(),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.colorize(),
                        winston.format.printf(({ timestamp, level, message, ...meta }) => {
                            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
                        }),
                    ),
                }),
                // ✅ File logging untuk tracking DDoS attacks
                new winston.transports.File({
                    filename: 'logs/security.log',
                    level: 'warn',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                    ),
                }),
            ],
        }),
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig, jwtConfig, databaseConfig],
        }),
    ],
    providers: [
        PrismaService,
        ValidationService,
        DDoSProtectionMiddleware, // ✅ Add as provider
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseInterceptor,
        },
    ],
    exports: [
        PrismaService,
        ValidationService,
        DDoSProtectionMiddleware, // ✅ Export for monitoring
    ],
})
export class CommonModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // ✅ Apply DDoS Protection FIRST (before BlacklistToken)
        consumer
            .apply(DDoSProtectionMiddleware)
            .forRoutes('*');

        // ✅ Then apply BlacklistToken
        consumer
            .apply(BlacklistTokenMiddleware)
            .forRoutes('*');
    }
}