import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express'; // Impor tipe Request
import { PrismaService } from '../../common/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        const jwtSecret = configService.get<string>('jwt.secret');

        if (!jwtSecret) {
            throw new Error('JWT secret is not configured');
        }

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                JwtStrategy.extractJWTFromCookie,
            ]),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    // >>> TAMBAHKAN FUNGSI STATIS INI UNTUK MENGAMBIL TOKEN DARI COOKIE <<<
    private static extractJWTFromCookie(req: Request): string | null {
        if (req.cookies && 'access_token' in req.cookies) {
            return req.cookies.access_token;
        }
        return null;
    }

    async validate(payload: JwtPayload): Promise<JwtPayload> {
        const { id } = payload;

        // Check if user exists and is active
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                isActive: true,
                deletedAt: true,
            },
        });

        if (!user || user.deletedAt) {
            throw new UnauthorizedException('User not found');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account has been suspended');
        }

        return {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        };
    }
}