import {Global, MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ValidationService } from './validation.service';
import { PrismaService } from './prisma.service';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { BlacklistTokenMiddleware } from './middleware/blacklist-token.middleware';
import appConfig from '../config/app.config';
import jwtConfig from '../config/jwt.config';
import databaseConfig from '../config/database.config';

@Global()
@Module({
    imports: [
        WinstonModule.forRoot({
            format: winston.format.json(),
            transports: [new winston.transports.Console()],
        }),
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig, jwtConfig, databaseConfig],
        }),
    ],
    providers: [
        PrismaService,
        ValidationService,
        // Global Exception Filter
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter,
        },
        // Global Response Interceptor
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseInterceptor,
        },
    ],
    exports: [PrismaService, ValidationService],
})
export class CommonModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(BlacklistTokenMiddleware)
            .forRoutes('*'); // Apply to all routes
    }
}