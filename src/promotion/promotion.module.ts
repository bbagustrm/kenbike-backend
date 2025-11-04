import { Module } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { ScheduleModule } from '@nestjs/schedule';
import { PromotionController, AdminPromotionController } from './promotion.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
  ],
  controllers: [PromotionController, AdminPromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
