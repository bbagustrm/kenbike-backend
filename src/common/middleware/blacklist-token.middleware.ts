import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BlacklistTokenMiddleware implements NestMiddleware {
    constructor(private prisma: PrismaService) {}

    async use(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            console.log('🔍 Checking token:', token.substring(0, 20) + '...'); // ← ADD LOG

            // Check if token is blacklisted
            const blacklistedToken = await this.prisma.blacklistedToken.findUnique({
                where: { token },
            });

            if (blacklistedToken) {
                console.log('❌ Token IS blacklisted:', { // ← ADD LOG
                    userId: blacklistedToken.userId,
                    createdAt: blacklistedToken.createdAt,
                    expiresAt: blacklistedToken.expiresAt,
                });
                throw new UnauthorizedException('Token has been revoked');
            }

            console.log('✅ Token is NOT blacklisted'); // ← ADD LOG
        }

        next();
    }
}