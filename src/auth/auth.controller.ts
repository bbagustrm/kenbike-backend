import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    UseGuards,
    Req,
    Res,
    UseInterceptors,
    UploadedFile,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ValidationService } from '../common/validation.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FileUploadUtil } from '../utils/file-upload.util';
import { Throttle } from '@nestjs/throttler';

import { RegisterDto, RegisterSchema } from './dto/register.dto';
import { LoginDto, LoginSchema } from './dto/login.dto';
import { ForgotPasswordDto, ForgotPasswordSchema } from './dto/forgot-password.dto';
import { ResetPasswordDto, ResetPasswordSchema } from './dto/reset-password.dto';
import { UpdateProfileDto, UpdateProfileSchema } from './dto/update-profile.dto';
import { UpdatePasswordDto, UpdatePasswordSchema } from './dto/update-password.dto';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private validationService: ValidationService,
    ) {}

    /**
     * POST /auth/register
     */
    @Public()
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() body: RegisterDto) {
        const dto = this.validationService.validate(RegisterSchema, body);
        return this.authService.register(dto);
    }

    /**
     * POST /auth/login
     */
    @Public()
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() body: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const dto = this.validationService.validate(LoginSchema, body);
        const result = await this.authService.login(dto);

        const origin = req.headers.origin || '';
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

        const cookieOptions = {
            httpOnly: true,
            secure: !isLocalhost,
            sameSite: 'lax' as const,
            path: '/',
            ...(isLocalhost ? {} : { domain: '.kenbike.store' }),
        };

        res.cookie('access_token', result.data.access_token, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000,
        });

        res.cookie('refresh_token', result.data.refresh_token, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        console.log('✅ Cookies set for user:', result.data.user.email);
        console.log('🌐 Origin:', origin, '| Localhost:', isLocalhost);

        return result;
    }

    /**
     * POST /auth/refresh
     */
    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.refreshToken(req);

        const origin = req.headers.origin || '';
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

        res.cookie('access_token', result.data.access_token, {
            httpOnly: true,
            secure: !isLocalhost,
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 60 * 1000,
            ...(isLocalhost ? {} : { domain: '.kenbike.store' }),
        });

        console.log('✅ Access token refreshed');

        return result;
    }

    /**
     * POST /auth/forgot-password
     */
    @Public()
    @Throttle({ default: { limit: 3, ttl: 300000 } })
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() body: ForgotPasswordDto) {
        const dto = this.validationService.validate(ForgotPasswordSchema, body);
        return this.authService.forgotPassword(dto);
    }

    /**
     * POST /auth/reset-password
     */
    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() body: ResetPasswordDto) {
        const dto = this.validationService.validate(ResetPasswordSchema, body);
        return this.authService.resetPassword(dto);
    }

    /**
     * POST /auth/logout
     */
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(
        @CurrentUser('id') userId: string,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const token = req.cookies?.access_token;

        if (!token) {
            throw new BadRequestException('Access token cookie is required');
        }

        const result = await this.authService.logout(userId, token);

        const origin = req.headers.origin || '';
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

        const clearOptions = {
            httpOnly: true,
            secure: !isLocalhost,
            sameSite: 'lax' as const,
            path: '/',
            ...(isLocalhost ? {} : { domain: '.kenbike.store' }),
        };

        res.clearCookie('access_token', clearOptions);
        res.clearCookie('refresh_token', clearOptions);

        console.log('✅ Cookies cleared for user:', userId);

        return result;
    }

    /**
     * GET /auth/me
     */
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getCurrentUser(@CurrentUser('id') userId: string) {
        return this.authService.getCurrentUser(userId);
    }

    /**
     * PATCH /auth/profile
     */
    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    @UseInterceptors(
        FileInterceptor('profile_image', {
            fileFilter: FileUploadUtil.imageFileFilter,
            limits: {
                fileSize: 2 * 1024 * 1024,
            },
        }),
    )
    async updateProfile(
        @CurrentUser('id') userId: string,
        @Body() body: UpdateProfileDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (file) {
            FileUploadUtil.validateImageFile(file);
        }

        const dto = this.validationService.validate(UpdateProfileSchema, body);
        return this.authService.updateProfile(userId, dto, file);
    }

    /**
     * PATCH /auth/password
     */
    @UseGuards(JwtAuthGuard)
    @Patch('password')
    async updatePassword(
        @CurrentUser('id') userId: string,
        @Body() body: UpdatePasswordDto,
    ) {
        const dto = this.validationService.validate(UpdatePasswordSchema, body);
        return this.authService.updatePassword(userId, dto);
    }

    /**
     * DELETE /auth/profile-image
     */
    @UseGuards(JwtAuthGuard)
    @Delete('profile-image')
    async deleteProfileImage(@CurrentUser('id') userId: string) {
        return this.authService.deleteProfileImage(userId);
    }
}