import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PrismaService } from '../common/prisma.service';
import { ValidationService } from '../common/validation.service';

@Module({
  controllers: [CartController],
  providers: [CartService, PrismaService, ValidationService],
  exports: [CartService],
})
export class CartModule {}