// src/discussion/discussion.module.ts
import { Module } from '@nestjs/common';
import { DiscussionService } from './discussion.service';
import { DiscussionController, AdminDiscussionController } from './discussion.controller';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [CommonModule],
    controllers: [DiscussionController, AdminDiscussionController],
    providers: [DiscussionService],
    exports: [DiscussionService],
})
export class DiscussionModule {}