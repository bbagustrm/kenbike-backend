import { Controller, Get } from '@nestjs/common';
import {Public} from "./common/decorators/public.decorator";

@Controller()
export class AppController {

    @Get()
    root() {
        return {
            message: 'KenBike API is running',
        };
    }

    @Public()
    @Get('health')
    health() {
        return {
            status: 'ok',
            service: 'kenbike-backend',
            timestamp: new Date().toISOString(),
        };
    }
}
