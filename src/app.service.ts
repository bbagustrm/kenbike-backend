import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): string {
    this.logger.log('GetHello called');
    this.logger.warn('This is a warning');
    this.logger.error('This is an error');
    return 'Hello World';
  }
}
