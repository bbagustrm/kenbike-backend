import { sign, verify } from 'jsonwebtoken';

export interface JwtPayload {
    id: string;
    email: string;
    username: string;
    role: string;
}

export class TokenUtil {
    /**
     * Generate JWT Access Token
     */
    static generateAccessToken(payload: JwtPayload, secret: string, expiresIn: string): string {
        return sign(payload, secret, { expiresIn });
    }

    /**
     * Generate JWT Refresh Token
     */
    static generateRefreshToken(payload: JwtPayload, secret: string, expiresIn: string): string {
        return sign(payload, secret, { expiresIn });
    }

    /**
     * Generate Password Reset Token
     */
    static generateResetPasswordToken(email: string, secret: string, expiresIn: string): string {
        return sign({ email, type: 'password-reset' }, secret, { expiresIn });
    }

    /**
     * Verify JWT Token
     */
    static verifyToken<T = any>(token: string, secret: string): T {
        return verify(token, secret) as T;
    }

    /**
     * Decode JWT Token without verification (for getting payload)
     */
    static decodeToken<T = any>(token: string): T | null {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;

            const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
            return JSON.parse(payload);
        } catch {
            return null;
        }
    }

    /**
     * Get token expiry date
     */
    static getTokenExpiry(expiresIn: string): Date {
        const now = new Date();
        const timeValue = parseInt(expiresIn);
        const timeUnit = expiresIn.slice(-1);

        switch (timeUnit) {
            case 's': // seconds
                now.setSeconds(now.getSeconds() + timeValue);
                break;
            case 'm': // minutes
                now.setMinutes(now.getMinutes() + timeValue);
                break;
            case 'h': // hours
                now.setHours(now.getHours() + timeValue);
                break;
            case 'd': // days
                now.setDate(now.getDate() + timeValue);
                break;
            default:
                now.setMinutes(now.getMinutes() + 15); // default 15 minutes
        }

        return now;
    }
}