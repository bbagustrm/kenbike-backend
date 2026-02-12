import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m', // 15 minutes
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d', // 7 days
    resetPasswordTokenExpiry: process.env.JWT_RESET_PASSWORD_EXPIRY || '1h', // 1 hour
}));