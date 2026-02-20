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

    private readonly IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

    // ============================================================
    // LOAD TEST MODE
    // Set LOAD_TEST_MODE=true di .env saat JMeter testing
    // Set kembali false setelah selesai testing
    // ============================================================
    private readonly IS_LOAD_TEST = process.env.LOAD_TEST_MODE === 'true';

    private readonly WHITELISTED_IPS = [
        '::1',
        '127.0.0.1',
        '::ffff:127.0.0.1',
        'localhost',
    ];

    private readonly WINDOW_MS = 10000;

    // Saat load test: naikkan limit drastis agar tidak block JMeter
    private readonly MAX_REQUESTS = this.IS_LOAD_TEST
        ? 99999
        : this.IS_DEVELOPMENT ? 200 : 50;

    private readonly BLOCK_DURATION = this.IS_DEVELOPMENT ? 60000 : 300000;

    private readonly SUSPICIOUS_THRESHOLD = this.IS_LOAD_TEST
        ? 999999
        : this.IS_DEVELOPMENT ? 500 : 100;

    use(req: Request, res: Response, next: NextFunction) {
        // ============================================================
        // LOAD TEST MODE: bypass semua proteksi
        // ============================================================
        if (this.IS_LOAD_TEST) {
            return next();
        }

        const ip = this.getClientIp(req);
        const now = Date.now();
        const path = req.path;

        if (path.includes('/health')) {
            return next();
        }

        if (this.IS_DEVELOPMENT && this.isWhitelisted(ip)) {
            return next();
        }

        if (this.isWhitelisted(ip)) {
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

    private isWhitelisted(ip: string): boolean {
        return this.WHITELISTED_IPS.some(whitelisted =>
            ip === whitelisted || ip.includes(whitelisted)
        );
    }

    private handleWhitelistedIP(
        req: Request,
        res: Response,
        next: NextFunction,
        ip: string,
        now: number
    ): void {
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
                this.requestMap.set(ip, { count: 1, firstRequest: now, suspiciousScore: 0 });
            } else {
                this.requestMap.set(ip, requestData);
            }
        } else {
            this.requestMap.set(ip, { count: 1, firstRequest: now, suspiciousScore: 0 });
        }

        next();
    }

    private calculateSuspiciousScore(req: Request, data: RequestData): number {
        let score = 0;

        const userAgent = (req.headers['user-agent'] || '').toLowerCase();

        // ============================================================
        // Trusted user agents - browser & testing tools
        // ============================================================
        const trustedAgents = [
            // Browsers
            'mozilla', 'chrome', 'safari', 'firefox', 'edge',
            // Testing tools - JMeter, Postman, etc
            'apache-httpclient',   // JMeter default user agent
            'java/',               // JMeter kadang pakai ini
            'postmanruntime',      // Postman
            'insomnia',            // Insomnia
        ];

        const isTrustedAgent = trustedAgents.some(agent => userAgent.includes(agent));

        if (isTrustedAgent) {
            const timeSinceFirst = Date.now() - data.firstRequest;
            if (data.count > 30 && timeSinceFirst < 500) {
                score += 5;
            }
            return score;
        }

        // Non-trusted agents get normal scoring
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
        if (this.isWhitelisted(ip)) return false;
        if (!this.blockedIPs.has(ip)) return false;

        const blockTime = this.blockedIPs.get(ip);
        if (blockTime === undefined) return false;

        if (now - blockTime < this.BLOCK_DURATION) return true;

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
        if (realIp) return realIp as string;

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

    unblockIP(ip: string): boolean {
        if (this.blockedIPs.has(ip)) {
            this.blockedIPs.delete(ip);
            console.info(`✅ IP manually unblocked: ${ip}`);
            return true;
        }
        return false;
    }

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
            loadTestMode: this.IS_LOAD_TEST,
            limits: {
                maxRequests: this.MAX_REQUESTS,
                windowMs: this.WINDOW_MS,
                blockDuration: this.BLOCK_DURATION,
                suspiciousThreshold: this.SUSPICIOUS_THRESHOLD,
            }
        };
    }
}