import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController, AdminProductController } from './product.controller';

@Module({
    controllers: [ProductController, AdminProductController],
    providers: [ProductService],
    exports: [ProductService],
})
export class ProductModule {}