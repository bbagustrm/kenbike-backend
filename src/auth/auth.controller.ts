import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    UseGuards,
    Req,
    UseInterceptors,
    UploadedFile,
    HttpCode,
    HttpStatus, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ValidationService } from '../common/validation.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FileUploadUtil } from '../utils/file-upload.util';
import { Throttle } from '@nestjs/throttler';

// DTOs
import { RegisterDto, RegisterSchema } from './dto/register.dto';
import { LoginDto, LoginSchema } from './dto/login.dto';
import { RefreshTokenDto, RefreshTokenSchema } from './dto/refresh-token.dto';
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
     * POST /auth/login
     * Login user
     */
    @Public()
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() body: LoginDto) {
        const dto = this.validationService.validate(LoginSchema, body);
        return this.authService.login(dto);
    }

    /**
     * POST /auth/refresh
     * Refresh access token
     */
    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(@Body() body: RefreshTokenDto) {
        const dto = this.validationService.validate(RefreshTokenSchema, body);
        return this.authService.refreshToken(dto);
    }

    /**
     * POST /auth/forgot-password
     * Send password reset email
     */
    @Public()
    @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() body: ForgotPasswordDto) {
        const dto = this.validationService.validate(ForgotPasswordSchema, body);
        return this.authService.forgotPassword(dto);
    }

    /**
     * POST /auth/reset-password
     * Reset password with token
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
     * Logout and blacklist token
     */
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@CurrentUser('id') userId: string, @Req() req: Request) {
        const token = req.cookies?.access_token;

        if (!token) {
            throw new BadRequestException('Access token cookie is required');
        }

        return this.authService.logout(userId, token);
    }

    /**
     * GET /auth/me
     * Get current user profile
     */
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getCurrentUser(@CurrentUser('id') userId: string) {
        return this.authService.getCurrentUser(userId);
    }

    /**
     * PATCH /auth/profile
     * Update user profile
     */
    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    @UseInterceptors(
        FileInterceptor('profile_image', {
            fileFilter: FileUploadUtil.imageFileFilter,
            limits: {
                fileSize: 2 * 1024 * 1024, // 2MB
            },
        }),
    )
    async updateProfile(
        @CurrentUser('id') userId: string,
        @Body() body: UpdateProfileDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        // Validate file if uploaded
        if (file) {
            FileUploadUtil.validateImageFile(file);
        }

        const dto = this.validationService.validate(UpdateProfileSchema, body);
        return this.authService.updateProfile(userId, dto, file);
    }

    /**
     * PATCH /auth/password
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
     * DELETE /auth/profile-image
     * Delete profile image
     */
    @UseGuards(JwtAuthGuard)
    @Delete('profile-image')
    async deleteProfileImage(@CurrentUser('id') userId: string) {
        return this.authService.deleteProfileImage(userId);
    }
}