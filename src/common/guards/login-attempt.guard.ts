import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface LoginAttemptData {
    attempts: number;
    firstAttempt: number;
    lockedUntil?: number;
}

@Injectable()
export class LoginAttemptGuard implements CanActivate {
    // In-memory storage: Map<key, attemptData>
    // Key format: "ip:email" untuk track both IP and email
    private loginAttempts = new Map<string, LoginAttemptData>();

    // Configuration
    private readonly MAX_ATTEMPTS = 5; // Max 5 failed attempts
    private readonly LOCK_DURATION = 15 * 60 * 1000; // Lock for 15 minutes
    private readonly ATTEMPT_WINDOW = 15 * 60 * 1000; // Reset counter after 15 minutes of first attempt

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const ip = this.getClientIp(request);
        const email = request.body?.email;

        // Skip validation if no email provided (will be handled by validation pipe)
        if (!email) {
            return true;
        }

        const key = this.generateKey(ip, email);
        const now = Date.now();

        // Check if IP+Email combination is currently locked
        const attemptData = this.loginAttempts.get(key);

        if (attemptData?.lockedUntil) {
            if (now < attemptData.lockedUntil) {
                // Still locked
                const remainingTime = Math.ceil((attemptData.lockedUntil - now) / 1000 / 60);

                console.warn(`🔒 Login blocked: ${email} from ${ip} - ${remainingTime} minutes remaining`);

                throw new HttpException(
                    {
                        statusCode: HttpStatus.TOO_MANY_REQUESTS,
                        message: 'Too many failed login attempts',
                        error: 'Account Locked',
                        remainingAttempts: 0,
                        lockedUntil: new Date(attemptData.lockedUntil).toISOString(),
                        retryAfter: remainingTime,
                    },
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            } else {
                // Lock expired, reset attempts
                this.loginAttempts.delete(key);
                console.info(`✅ Lock expired for: ${email} from ${ip}`);
            }
        }

        // If exists, check if attempt window expired
        if (attemptData && !attemptData.lockedUntil) {
            const timeSinceFirst = now - attemptData.firstAttempt;

            if (timeSinceFirst > this.ATTEMPT_WINDOW) {
                // Window expired, reset counter
                this.loginAttempts.delete(key);
                console.info(`🔄 Attempt window expired, resetting counter for: ${email}`);
            }
        }

        // Allow the request to proceed to controller
        // We'll track failed attempts in auth.service after validation
        return true;
    }

    /**
     * Record a failed login attempt
     * Called from AuthService after password validation fails
     */
    recordFailedAttempt(ip: string, email: string): {
        remainingAttempts: number;
        isLocked: boolean;
        lockedUntil?: Date;
    } {
        const key = this.generateKey(ip, email);
        const now = Date.now();

        const attemptData = this.loginAttempts.get(key) || {
            attempts: 0,
            firstAttempt: now,
        };

        attemptData.attempts++;

        // Check if should be locked
        if (attemptData.attempts >= this.MAX_ATTEMPTS) {
            attemptData.lockedUntil = now + this.LOCK_DURATION;
            this.loginAttempts.set(key, attemptData);

            console.warn(
                `🚨 Account locked: ${email} from ${ip} - Too many failed attempts (${attemptData.attempts})`
            );

            // Schedule auto-cleanup after lock expires
            setTimeout(() => {
                if (this.loginAttempts.has(key)) {
                    this.loginAttempts.delete(key);
                    console.info(`✅ Auto-unlocked: ${email} from ${ip}`);
                }
            }, this.LOCK_DURATION);

            return {
                remainingAttempts: 0,
                isLocked: true,
                lockedUntil: new Date(attemptData.lockedUntil),
            };
        }

        this.loginAttempts.set(key, attemptData);

        const remaining = this.MAX_ATTEMPTS - attemptData.attempts;
        console.warn(
            `⚠️ Failed login attempt ${attemptData.attempts}/${this.MAX_ATTEMPTS} for ${email} from ${ip} - ${remaining} attempts remaining`
        );

        return {
            remainingAttempts: remaining,
            isLocked: false,
        };
    }

    /**
     * Reset login attempts after successful login
     */
    resetAttempts(ip: string, email: string): void {
        const key = this.generateKey(ip, email);

        if (this.loginAttempts.has(key)) {
            this.loginAttempts.delete(key);
            console.info(`✅ Login attempts reset for: ${email} from ${ip}`);
        }
    }

    /**
     * Check if IP+Email is currently locked
     */
    isLocked(ip: string, email: string): boolean {
        const key = this.generateKey(ip, email);
        const attemptData = this.loginAttempts.get(key);

        if (!attemptData?.lockedUntil) {
            return false;
        }

        const now = Date.now();
        if (now < attemptData.lockedUntil) {
            return true;
        }

        // Lock expired
        this.loginAttempts.delete(key);
        return false;
    }

    /**
     * Get remaining attempts for IP+Email
     */
    getRemainingAttempts(ip: string, email: string): number {
        const key = this.generateKey(ip, email);
        const attemptData = this.loginAttempts.get(key);

        if (!attemptData) {
            return this.MAX_ATTEMPTS;
        }

        if (attemptData.lockedUntil && Date.now() < attemptData.lockedUntil) {
            return 0;
        }

        return Math.max(0, this.MAX_ATTEMPTS - attemptData.attempts);
    }

    /**
     * Generate unique key for IP + Email combination
     */
    private generateKey(ip: string, email: string): string {
        return `${ip}:${email.toLowerCase()}`;
    }

    /**
     * Extract client IP from request
     */
    private getClientIp(req: Request): string {
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor) {
            const ips = (forwardedFor as string).split(',');
            return ips[0].trim();
        }

        const realIp = req.headers['x-real-ip'];
        if (realIp) {
            return realIp as string;
        }

        return req.socket.remoteAddress || 'unknown';
    }

    /**
     * Get statistics (for monitoring/admin dashboard)
     */
    getStats() {
        const now = Date.now();
        const locked: string[] = [];
        const active: string[] = [];

        for (const [key, data] of this.loginAttempts.entries()) {
            if (data.lockedUntil && now < data.lockedUntil) {
                locked.push(key);
            } else {
                active.push(key);
            }
        }

        return {
            totalTracked: this.loginAttempts.size,
            lockedAccounts: locked.length,
            activeAttempts: active.length,
            lockedList: locked,
        };
    }

    /**
     * Manual unlock (for admin use)
     */
    manualUnlock(ip: string, email: string): boolean {
        const key = this.generateKey(ip, email);

        if (this.loginAttempts.has(key)) {
            this.loginAttempts.delete(key);
            console.info(`🔓 Manual unlock: ${email} from ${ip}`);
            return true;
        }

        return false;
    }
}