import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderController } from './order.controller';
import { AdminOrderController } from './admin-order.controller';
import { OrderService } from './order.service';
import { BiteshipService } from './biteship.service';
import { InternationalShippingService } from './international-shipping.service';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';

@Module({
  imports: [ConfigModule],
  controllers: [
    OrderController,
    AdminOrderController,
  ],
  providers: [
    OrderService,
    BiteshipService,
    InternationalShippingService,
    PrismaService,
    ValidationService,
  ],
  exports: [OrderService],
})
export class OrderModule {}