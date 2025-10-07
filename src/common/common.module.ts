import {Global, Module} from '@nestjs/common';
import {WinstonModule} from 'nest-winston';
import * as winston from 'winston';
import {ConfigModule} from '@nestjs/config';
import {ValidationService} from "./validation.service";
import {PrismaService} from "./prisma.service";
import appConfig from '../config/app.config';
import jwtConfig from '../config/jwt.config';
import databaseConfig from '../config/database.config';

@Global()
@Module({
    imports: [
        WinstonModule.forRoot({
            format: winston.format.json(),
            transports: [new winston.transports.Console()]
        }),
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig, jwtConfig, databaseConfig],
        }),
    ],
    providers: [PrismaService, ValidationService],
    exports: [PrismaService, ValidationService],
})
export class CommonModule {}
