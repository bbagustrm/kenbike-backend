import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV ,
    appName: process.env.APP_NAME ,
}));