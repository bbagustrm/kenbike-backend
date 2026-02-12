// src/review/review.module.ts
import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { AdminReviewController } from './admin-review.controller';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [CommonModule],
    controllers: [ReviewController, AdminReviewController],
    providers: [ReviewService],
    exports: [ReviewService],
})
export class ReviewModule {}