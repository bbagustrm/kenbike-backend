// src/return/return.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReturnController } from './return.controller';
import { ReturnService } from './return.service';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';
import { NotificationModule } from '../notification/notification.module';
import { EmailService } from '../common/email.service';

@Module({
  imports: [
    NotificationModule,
    ConfigModule,
  ],
  controllers: [ReturnController],
  providers: [
    ReturnService,
    PrismaService,
    ValidationService,
    EmailService,
  ],
  exports: [ReturnService],
})
export class ReturnModule {}