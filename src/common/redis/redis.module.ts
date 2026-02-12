import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis Module
 *
 * Global module providing Redis caching service
 * Uses ioredis directly for better compatibility with NestJS 11
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}