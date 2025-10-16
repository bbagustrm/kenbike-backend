import { Module } from '@nestjs/common';
import { TagService } from './tag.service';
import { TagController, AdminTagController } from './tag.controller';
import { ProductModule } from '../product/product.module';

@Module({
    controllers: [TagController, AdminTagController],
    providers: [TagService],
    exports: [TagService],
    imports: [ProductModule],
})
export class TagModule {}