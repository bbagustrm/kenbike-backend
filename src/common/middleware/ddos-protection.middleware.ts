import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RequestData {
    count: number;
    firstRequest: number;
    suspiciousScore: number;
}

@Injectable()
export class DDoSProtectionMiddleware implements NestMiddleware {
    private requestMap = new Map<string, RequestData>();
    private blockedIPs = new Map<string, number>();

    // ✅ Configurable based on environment
    private readonly IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

    // ✅ Whitelist localhost IPs (IPv4 and IPv6)
    private readonly WHITELISTED_IPS = [
        '::1',           // IPv6 localhost
        '127.0.0.1',     // IPv4 localhost
        '::ffff:127.0.0.1', // IPv4-mapped IPv6
        'localhost',
    ];

    // ✅ Adjusted limits - more lenient for development
    private readonly WINDOW_MS = 10000; // 10 seconds
    private readonly MAX_REQUESTS = this.IS_DEVELOPMENT ? 200 : 50; // Higher limit in dev
    private readonly BLOCK_DURATION = this.IS_DEVELOPMENT ? 60000 : 300000; // 1 min dev, 5 min prod
    private readonly SUSPICIOUS_THRESHOLD = this.IS_DEVELOPMENT ? 500 : 100; // Higher threshold in dev

    use(req: Request, res: Response, next: NextFunction) {
        const ip = this.getClientIp(req);
        const now = Date.now();
        const path = req.path;

        // ✅ Skip health check endpoints
        if (path.includes('/health')) {
            return next();
        }

        // ✅ NEW: Skip DDoS check for whitelisted IPs (localhost) in development
        if (this.IS_DEVELOPMENT && this.isWhitelisted(ip)) {
            return next();
        }

        // ✅ In production, still apply rate limiting to localhost but with higher limits
        if (this.isWhitelisted(ip)) {
            // For whitelisted IPs in production, use more lenient limits
            return this.handleWhitelistedIP(req, res, next, ip, now);
        }

        if (this.isBlocked(ip, now)) {
            console.warn(`⛔ Blocked IP attempted access: ${ip}`);

            const blockTime = this.blockedIPs.get(ip) ?? now;
            const blockedUntil = new Date(blockTime + this.BLOCK_DURATION).toISOString();

            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Too many requests. Your IP has been temporarily blocked.',
                    blockedUntil: blockedUntil,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        const requestData = this.requestMap.get(ip) || {
            count: 0,
            firstRequest: now,
            suspiciousScore: 0
        };

        const timeDiff = now - requestData.firstRequest;

        const suspiciousScore = this.calculateSuspiciousScore(req, requestData);
        requestData.suspiciousScore += suspiciousScore;

        if (requestData.suspiciousScore >= this.SUSPICIOUS_THRESHOLD) {
            this.blockIP(ip, now);
            console.warn(`🚨 IP auto-blocked due to suspicious activity: ${ip} (Score: ${requestData.suspiciousScore})`);

            throw new HttpException(
                'Suspicious activity detected. IP blocked.',
                HttpStatus.FORBIDDEN,
            );
        }

        if (timeDiff < this.WINDOW_MS) {
            requestData.count++;

            if (requestData.count > this.MAX_REQUESTS) {
                this.blockIP(ip, now);
                this.requestMap.delete(ip);

                console.warn(`⚠️ DDoS detected from IP: ${ip} - Blocked for ${this.BLOCK_DURATION / 1000}s (${requestData.count} requests in ${timeDiff}ms)`);

                throw new HttpException(
                    {
                        statusCode: HttpStatus.TOO_MANY_REQUESTS,
                        message: 'Too many requests. Your IP has been temporarily blocked.',
                        requestCount: requestData.count,
                        timeWindow: `${timeDiff}ms`,
                    },
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            if (requestData.count > this.MAX_REQUESTS * 0.8) {
                console.warn(`⚠️ IP approaching rate limit: ${ip} (${requestData.count}/${this.MAX_REQUESTS})`);
            }

            this.requestMap.set(ip, requestData);
        } else {
            this.requestMap.set(ip, {
                count: 1,
                firstRequest: now,
                suspiciousScore: Math.max(0, requestData.suspiciousScore - 10)
            });
        }

        if (Math.random() < 0.01) {
            this.cleanup(now);
        }

        next();
    }

    /**
     * ✅ NEW: Check if IP is in whitelist
     */
    private isWhitelisted(ip: string): boolean {
        return this.WHITELISTED_IPS.some(whitelisted =>
            ip === whitelisted || ip.includes(whitelisted)
        );
    }

    /**
     * ✅ NEW: Handle whitelisted IPs with more lenient limits (for production)
     */
    private handleWhitelistedIP(
        req: Request,
        res: Response,
        next: NextFunction,
        ip: string,
        now: number
    ): void {
        // Use much higher limits for whitelisted IPs
        const WHITELIST_MAX_REQUESTS = 500;
        const WHITELIST_WINDOW_MS = 10000;

        const requestData = this.requestMap.get(ip) || {
            count: 0,
            firstRequest: now,
            suspiciousScore: 0
        };

        const timeDiff = now - requestData.firstRequest;

        if (timeDiff < WHITELIST_WINDOW_MS) {
            requestData.count++;

            if (requestData.count > WHITELIST_MAX_REQUESTS) {
                console.warn(`⚠️ Whitelisted IP ${ip} exceeded high limit: ${requestData.count}/${WHITELIST_MAX_REQUESTS}`);
                // Don't block, just warn and reset
                this.requestMap.set(ip, {
                    count: 1,
                    firstRequest: now,
                    suspiciousScore: 0
                });
            } else {
                this.requestMap.set(ip, requestData);
            }
        } else {
            this.requestMap.set(ip, {
                count: 1,
                firstRequest: now,
                suspiciousScore: 0
            });
        }

        next();
    }

    private calculateSuspiciousScore(req: Request, data: RequestData): number {
        let score = 0;

        // ✅ Skip suspicious scoring for common browser patterns
        const userAgent = (req.headers['user-agent'] || '').toLowerCase();

        // Common browsers should have low suspicion
        const trustedBrowsers = ['mozilla', 'chrome', 'safari', 'firefox', 'edge'];
        const isTrustedBrowser = trustedBrowsers.some(browser => userAgent.includes(browser));

        if (isTrustedBrowser) {
            // Trusted browsers get much lower scores
            const timeSinceFirst = Date.now() - data.firstRequest;
            if (data.count > 30 && timeSinceFirst < 500) {
                score += 5; // Reduced from 20
            }
            return score;
        }

        // Non-browser requests get normal scoring
        const timeSinceFirst = Date.now() - data.firstRequest;
        if (data.count > 5 && timeSinceFirst < 500) {
            score += 20;
        }

        const suspiciousAgents = ['curl', 'wget', 'python-requests', 'bot', 'crawler', 'spider', 'scrapy'];
        if (suspiciousAgents.some(agent => userAgent.includes(agent))) {
            score += 10;
        }

        if (!req.headers['user-agent'] || !req.headers['accept']) {
            score += 15;
        }

        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > 1000000 && !req.path.includes('/upload')) {
            score += 25;
        }

        if (data.count > 20) {
            score += 5;
        }

        if (req.path.includes('/webhook')) {
            const contentType = req.headers['content-type'] || '';
            if (!contentType.includes('application/json')) {
                score += 10;
            }
        }

        return score;
    }

    private blockIP(ip: string, timestamp: number): void {
        // ✅ Never block whitelisted IPs
        if (this.isWhitelisted(ip)) {
            console.warn(`⚠️ Attempted to block whitelisted IP: ${ip} - SKIPPED`);
            return;
        }

        this.blockedIPs.set(ip, timestamp);

        setTimeout(() => {
            if (this.blockedIPs.has(ip)) {
                this.blockedIPs.delete(ip);
                console.info(`✅ IP unblocked: ${ip}`);
            }
        }, this.BLOCK_DURATION);
    }

    private isBlocked(ip: string, now: number): boolean {
        // ✅ Whitelisted IPs are never blocked
        if (this.isWhitelisted(ip)) {
            return false;
        }

        if (!this.blockedIPs.has(ip)) return false;

        const blockTime = this.blockedIPs.get(ip);

        if (blockTime === undefined) {
            return false;
        }

        if (now - blockTime < this.BLOCK_DURATION) {
            return true;
        }

        this.blockedIPs.delete(ip);
        return false;
    }

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

    private cleanup(now: number): void {
        for (const [ip, data] of this.requestMap.entries()) {
            if (now - data.firstRequest > this.WINDOW_MS * 2) {
                this.requestMap.delete(ip);
            }
        }

        for (const [ip, blockTime] of this.blockedIPs.entries()) {
            if (now - blockTime > this.BLOCK_DURATION) {
                this.blockedIPs.delete(ip);
            }
        }

        console.info(`🧹 Cleanup: Active IPs: ${this.requestMap.size}, Blocked IPs: ${this.blockedIPs.size}`);
    }

    /**
     * ✅ NEW: Manual unblock IP (useful for admin endpoints)
     */
    unblockIP(ip: string): boolean {
        if (this.blockedIPs.has(ip)) {
            this.blockedIPs.delete(ip);
            console.info(`✅ IP manually unblocked: ${ip}`);
            return true;
        }
        return false;
    }

    /**
     * ✅ NEW: Clear all blocked IPs (emergency reset)
     */
    clearAllBlocks(): void {
        const count = this.blockedIPs.size;
        this.blockedIPs.clear();
        this.requestMap.clear();
        console.info(`🔄 Cleared all blocks: ${count} IPs unblocked`);
    }

    getStats() {
        return {
            activeIPs: this.requestMap.size,
            blockedIPs: this.blockedIPs.size,
            blockedIPsList: Array.from(this.blockedIPs.keys()),
            environment: this.IS_DEVELOPMENT ? 'development' : 'production',
            limits: {
                maxRequests: this.MAX_REQUESTS,
                windowMs: this.WINDOW_MS,
                blockDuration: this.BLOCK_DURATION,
                suspiciousThreshold: this.SUSPICIOUS_THRESHOLD,
            }
        };
    }
}