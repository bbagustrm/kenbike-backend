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

    private readonly WINDOW_MS = 10000;
    private readonly MAX_REQUESTS = 50;
    private readonly BLOCK_DURATION = 300000;
    private readonly SUSPICIOUS_THRESHOLD = 100;

    use(req: Request, res: Response, next: NextFunction) {
        const ip = this.getClientIp(req);
        const now = Date.now();
        const path = req.path;

        if (path.includes('/health')) {
            return next();
        }

        if (this.isBlocked(ip, now)) {
            console.warn(`⛔ Blocked IP attempted access: ${ip}`);

            // ✅ FIX: Safely get blockTime with fallback
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

                console.warn(`⚠️ DDoS detected from IP: ${ip} - Blocked for 5 minutes (${requestData.count} requests in ${timeDiff}ms)`);

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

    private calculateSuspiciousScore(req: Request, data: RequestData): number {
        let score = 0;

        const timeSinceFirst = Date.now() - data.firstRequest;
        if (data.count > 5 && timeSinceFirst < 500) {
            score += 20;
        }

        const userAgent = (req.headers['user-agent'] || '').toLowerCase();
        const suspiciousAgents = ['curl', 'wget', 'python-requests', 'bot', 'crawler', 'spider'];
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
        this.blockedIPs.set(ip, timestamp);

        setTimeout(() => {
            if (this.blockedIPs.has(ip)) {
                this.blockedIPs.delete(ip);
                console.info(`✅ IP unblocked: ${ip}`);
            }
        }, this.BLOCK_DURATION);
    }

    private isBlocked(ip: string, now: number): boolean {
        if (!this.blockedIPs.has(ip)) return false;

        // ✅ FIX: Safely get blockTime with type guard
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

    getStats() {
        return {
            activeIPs: this.requestMap.size,
            blockedIPs: this.blockedIPs.size,
            blockedIPsList: Array.from(this.blockedIPs.keys()),
        };
    }
}