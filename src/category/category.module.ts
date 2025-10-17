import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController, AdminCategoryController } from './category.controller';
import {ProductModule} from "../product/product.module";

@Module({
    controllers: [CategoryController, AdminCategoryController],
    providers: [CategoryService],
    exports: [CategoryService],
    imports: [ProductModule],
})
export class CategoryModule {}