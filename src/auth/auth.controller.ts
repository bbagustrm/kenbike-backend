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
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { ValidationService } from '../common/validation.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoginAttemptGuard } from '../common/guards/login-attempt.guard';
import { FileUploadUtil } from '../utils/file-upload.util';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto, RegisterSchema } from './dto/register.dto';
import { LoginDto, LoginSchema } from './dto/login.dto';
import { ForgotPasswordDto, ForgotPasswordSchema } from './dto/forgot-password.dto';
import { ResetPasswordDto, ResetPasswordSchema } from './dto/reset-password.dto';
import { UpdateProfileDto, UpdateProfileSchema } from './dto/update-profile.dto';
import { UpdatePasswordDto, UpdatePasswordSchema } from './dto/update-password.dto';
import { GoogleUser } from './strategies/google.strategy';
import { CompleteProfileDto, CompleteProfileSchema } from './dto/complete-profile.dto';
import {VerifyOtpDto} from "./dto/verify-otp.dto";
import {ResendOtpDto} from "./dto/resend-otp.dto";

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private validationService: ValidationService,
        private loginAttemptGuard: LoginAttemptGuard,
        private configService: ConfigService,
    ) {}

    // ============================================
    // COOKIE CONFIGURATION
    // ============================================

    private getCookieOptions(req: Request) {
        const origin = req.headers.origin || '';
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

        if (isLocalhost) {
            return {
                httpOnly: true,
                secure: false,
                sameSite: 'lax' as const,
                path: '/',
            };
        }

        return {
            httpOnly: true,
            secure: true,
            sameSite: 'lax' as const,
            domain: '.kenbikestore.com',
            path: '/',
        };
    }

    // ============================================
    // LOCAL AUTHENTICATION ENDPOINTS
    // ============================================

    /**
     * Register new user
     */
    @Public()
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() body: RegisterDto) {
        const dto = this.validationService.validate(RegisterSchema, body);
        return this.authService.register(dto);
    }

    /**
     * Login with email and password
     */
    @Public()
    @UseGuards(LoginAttemptGuard)
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() body: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const dto = this.validationService.validate(LoginSchema, body);
        const result = await this.authService.login(dto, req);

        const cookieOptions = this.getCookieOptions(req);

        res.cookie('access_token', result.data.access_token, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie('refresh_token', result.data.refresh_token, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        console.log('✅ Cookies set for user:', result.data.user.email);

        return result;
    }

    // ============================================
    // GOOGLE OAUTH ENDPOINTS
    // ============================================

    /**
     * Initiate Google OAuth flow
     * Redirects user to Google's consent screen
     */
    @Public()
    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {
        // Guard handles redirect to Google
    }

    /**
     * Google OAuth callback
     * Handles the response from Google after user consent
     */
    @Public()
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(
        @Req() req: Request & { user: GoogleUser },
        @Res() res: Response,
    ) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

        try {
            const result = await this.authService.googleAuth(req.user);

            // Set cookies (untuk production dengan same domain)
            const cookieOptions = this.getCookieOptions(req);

            res.cookie('access_token', result.accessToken, {
                ...cookieOptions,
                maxAge: 15 * 60 * 1000,
            });

            res.cookie('refresh_token', result.refreshToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            console.log('✅ Google auth successful for:', result.user.email);

            // Encode data for frontend (include tokens for cross-origin development)
            const callbackData = encodeURIComponent(JSON.stringify({
                user: result.user,
                access_token: result.accessToken,
                refresh_token: result.refreshToken,
            }));

            // Check if user needs to complete profile (no phone number = new Google user)
            const needsProfileCompletion = !result.user.phone_number;

            res.redirect(
                `${frontendUrl}/auth/callback?success=true&data=${callbackData}&complete_profile=${needsProfileCompletion}`
            );
        } catch (error) {
            console.error('❌ Google auth error:', error);

            const errorMessage = encodeURIComponent(
                error.message || 'Authentication failed',
            );

            res.redirect(`${frontendUrl}/login?error=${errorMessage}`);
        }
    }

    // ============================================
    // TOKEN ENDPOINTS
    // ============================================

    /**
     * Refresh access token
     */
    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.refreshToken(req);

        const cookieOptions = this.getCookieOptions(req);

        res.cookie('access_token', result.data.access_token, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000,
        });

        console.log('✅ Access token refreshed');

        return result;
    }

    /**
     * Logout user
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

        const clearOptions = this.getCookieOptions(req);

        res.clearCookie('access_token', clearOptions);
        res.clearCookie('refresh_token', clearOptions);

        console.log('✅ Cookies cleared for user:', userId);

        return result;
    }

    // ============================================
    // PASSWORD RESET ENDPOINTS
    // ============================================

    /**
     * Request password reset email
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
     * Reset password with token
     */
    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() body: ResetPasswordDto) {
        const dto = this.validationService.validate(ResetPasswordSchema, body);
        return this.authService.resetPassword(dto);
    }

    // ============================================
    // PROFILE ENDPOINTS
    // ============================================

    /**
     * Get current user profile
     */
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getCurrentUser(@CurrentUser('id') userId: string) {
        return this.authService.getCurrentUser(userId);
    }

    /**
     * Update user profile
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
     * Update password
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
     * Delete profile image
     */
    @UseGuards(JwtAuthGuard)
    @Delete('profile-image')
    async deleteProfileImage(@CurrentUser('id') userId: string) {
        return this.authService.deleteProfileImage(userId);
    }


    /**
     * Complete user profile (for OAuth users)
     */
    @UseGuards(JwtAuthGuard)
    @Post('complete-profile')
    @HttpCode(HttpStatus.OK)
    async completeProfile(
        @CurrentUser('id') userId: string,
        @Body() body: CompleteProfileDto,
    ) {
        const dto = this.validationService.validate(CompleteProfileSchema, body);
        return this.authService.completeProfile(userId, dto);
    }

    /**
     * Check if user profile is complete
     */
    @UseGuards(JwtAuthGuard)
    @Get('profile-status')
    async checkProfileStatus(@CurrentUser('id') userId: string) {
        return this.authService.checkProfileComplete(userId);
    }

    // Tambahkan di auth.controller.ts

    @Public()
    @Post('verify-otp')
    async verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.authService.verifyOtp(dto);
    }

    @Public()
    @Post('resend-otp')
    async resendOtp(@Body() dto: ResendOtpDto) {
        return this.authService.resendOtp(dto);
    }

}