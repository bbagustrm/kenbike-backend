import { Module } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { PromotionController, AdminPromotionController } from './promotion.controller';

@Module({
  controllers: [PromotionController, AdminPromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
