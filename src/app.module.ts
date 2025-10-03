import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import {AppController} from "./app.controller";

@Module({
  imports: [CommonModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
