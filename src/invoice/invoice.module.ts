// src/invoice/invoice.module.ts

import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { PrismaService } from '../common/prisma.service';
import { BiteshipService } from '../order/biteship.service';

@Module({
    controllers: [InvoiceController],
    providers: [InvoiceService, PrismaService, BiteshipService],
    exports: [InvoiceService],
})
export class InvoiceModule {}