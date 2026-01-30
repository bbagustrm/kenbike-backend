import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    NotFoundException,
    Inject,
    InternalServerErrorException, BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { PasswordUtil } from '../utils/password.util';
import { TokenUtil, JwtPayload } from '../utils/token.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import {LocalStorageService} from "../common/storage/local-storage.service";
import { Request } from 'express';
import {EmailService} from "../common/email.service";
import {LoginAttemptGuard} from "../common/guards/login-attempt.guard";

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private localStorageService: LocalStorageService,
        private configService: ConfigService,
        private emailService: EmailService,
        private loginAttemptGuard: LoginAttemptGuard,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * Get JWT configuration with validation
     */
    private getJwtConfig() {
        const jwtSecret = this.configService.get<string>('jwt.secret');
        const accessTokenExpiry = this.configService.get<string>('jwt.accessTokenExpiry');
        const refreshTokenExpiry = this.configService.get<string>('jwt.refreshTokenExpiry');

        if (!jwtSecret) {
            throw new InternalServerErrorException('JWT secret is not configured');
        }

        if (!accessTokenExpiry) {
            throw new InternalServerErrorException('JWT access token expiry is not configured');
        }

        if (!refreshTokenExpiry) {
            throw new InternalServerErrorException('JWT refresh token expiry is not configured');
        }

        return {
            jwtSecret,
            accessTokenExpiry,
            refreshTokenExpiry,
        };
    }

    /**
     * Get reset token configuration with validation
     */
    private getResetTokenConfig() {
        const jwtSecret = this.configService.get<string>('jwt.secret');
        const resetTokenExpiry = this.configService.get<string>('jwt.resetPasswordTokenExpiry');

        if (!jwtSecret) {
            throw new InternalServerErrorException('JWT secret is not configured');
        }

        if (!resetTokenExpiry) {
            throw new InternalServerErrorException('JWT reset password token expiry is not configured');
        }

        return {
            jwtSecret,
            resetTokenExpiry,
        };
    }

    /**
     * Register new user
     */
    async register(dto: RegisterDto) {
        // Check if email already exists
        const existingEmail = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existingEmail) {
            throw new ConflictException({
                message: 'Registration failed',
                errors: [
                    {
                        field: 'email',
                        message: 'Email already registered',
                    },
                ],
            });
        }

        // Check if username already exists
        const existingUsername = await this.prisma.user.findUnique({
            where: { username: dto.username },
        });

        if (existingUsername) {
            throw new ConflictException({
                message: 'Registration failed',
                errors: [
                    {
                        field: 'username',
                        message: 'Username already taken',
                    },
                ],
            });
        }

        // Hash password
        const hashedPassword = await PasswordUtil.hashPassword(dto.password);

        // Create user
        const user = await this.prisma.user.create({
            data: {
                firstName: dto.first_name,
                lastName: dto.last_name,
                username: dto.username,
                email: dto.email,
                password: hashedPassword,
                phoneNumber: dto.phone_number,
                country: dto.country,
                city: dto.city,
                province: dto.province,
                district: dto.district,
                postalCode: dto.postal_code,
                address: dto.address,
                role: 'USER',
            },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
            },
        });

        this.logger.info(`New user registered: ${user.email}`);

        return {
            message: 'User registered successfully',
            data: user,
        };
    }

    /**
     * Login user
     */
    async login(dto: LoginDto, req: Request) {
        const ip = this.getClientIp(req);

        // Find user by email
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user || user.deletedAt) {
            // ✅ Record failed attempt
            const attemptResult = this.loginAttemptGuard.recordFailedAttempt(ip, dto.email);

            if (attemptResult.isLocked) {
                throw new UnauthorizedException({
                    statusCode: 429, // ✅ Add statusCode
                    message: 'Too many failed login attempts. Account temporarily locked.',
                    error: 'Account Locked', // ✅ Add error field
                    remainingAttempts: 0,
                    lockedUntil: attemptResult.lockedUntil,
                });
            }

            throw new UnauthorizedException({
                statusCode: 401, // ✅ Add statusCode
                message: 'Invalid email or password',
                error: 'Unauthorized', // ✅ Add error field
                remainingAttempts: attemptResult.remainingAttempts, // ✅ This will show now
            });
        }

        // Check if user is active
        if (!user.isActive) {
            const attemptResult = this.loginAttemptGuard.recordFailedAttempt(ip, dto.email);

            if (attemptResult.isLocked) {
                throw new UnauthorizedException({
                    statusCode: 429,
                    message: 'Too many failed login attempts. Account temporarily locked.',
                    error: 'Account Locked',
                    remainingAttempts: 0,
                    lockedUntil: attemptResult.lockedUntil,
                });
            }

            throw new UnauthorizedException({
                statusCode: 401,
                message: 'Account has been suspended',
                error: 'Account Suspended',
                remainingAttempts: attemptResult.remainingAttempts,
            });
        }

        // Verify password
        const isPasswordValid = await PasswordUtil.comparePassword(
            dto.password,
            user.password,
        );

        if (!isPasswordValid) {
            const attemptResult = this.loginAttemptGuard.recordFailedAttempt(ip, dto.email);

            if (attemptResult.isLocked) {
                throw new UnauthorizedException({
                    statusCode: 429,
                    message: 'Too many failed login attempts. Account temporarily locked.',
                    error: 'Account Locked',
                    remainingAttempts: 0,
                    lockedUntil: attemptResult.lockedUntil,
                });
            }

            throw new UnauthorizedException({
                statusCode: 401,
                message: 'Invalid email or password',
                error: 'Unauthorized',
                remainingAttempts: attemptResult.remainingAttempts,
            });
        }

        // ✅ Login successful - Reset attempts
        this.loginAttemptGuard.resetAttempts(ip, dto.email);

        // ... rest of the code (token generation, etc.) stays the same
        const payload: JwtPayload = {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        };

        const { jwtSecret, accessTokenExpiry, refreshTokenExpiry } = this.getJwtConfig();

        const accessToken = TokenUtil.generateAccessToken(payload, jwtSecret, accessTokenExpiry);
        const refreshToken = TokenUtil.generateRefreshToken(payload, jwtSecret, refreshTokenExpiry);

        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: TokenUtil.getTokenExpiry(refreshTokenExpiry),
            },
        });

        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        this.logger.info(`User logged in: ${user.email} from ${ip}`);

        return {
            message: 'Login successful',
            data: {
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: 'Bearer',
                expires_in: 900,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                },
            },
        };
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
     * Refresh access token
     */
    async refreshToken(req: Request) {
        const { jwtSecret, accessTokenExpiry } = this.getJwtConfig();

        // >>> PERUBAHAN: Ambil refresh_token dari cookie, bukan dari DTO <<<
        const refreshTokenValue = req.cookies?.refresh_token;

        if (!refreshTokenValue) {
            throw new UnauthorizedException('Refresh token not found in cookies');
        }

        // Verify refresh token
        let payload: JwtPayload;
        try {
            payload = TokenUtil.verifyToken<JwtPayload>(refreshTokenValue, jwtSecret);
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        // Check if refresh token exists in database
        const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
            where: { token: refreshTokenValue }, // Gunakan token dari cookie
        });

        if (!refreshTokenRecord) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        // Check if refresh token is expired
        if (refreshTokenRecord.expiresAt < new Date()) {
            // Delete expired token
            await this.prisma.refreshToken.delete({
                where: { token: refreshTokenValue }, // Gunakan token dari cookie
            });
            throw new UnauthorizedException('Refresh token has expired');
        }

        // Generate new access token
        const accessToken = TokenUtil.generateAccessToken(payload, jwtSecret, accessTokenExpiry);

        return {
            message: 'Token refreshed successfully',
            data: {
                access_token: accessToken,
                token_type: 'Bearer',
                expires_in: 900, // 15 minutes in seconds
            },
        };
    }

    /**
     * Forgot password - Send reset email
     */
    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        // For security, always return success even if email doesn't exist
        if (!user) {
            // Log attempt but still return success message
            this.logger.warn(`Password reset requested for non-existent email: ${dto.email}`);
            return {
                message: 'Password reset link has been sent to your email',
            };
        }

        // Generate reset token
        const { jwtSecret, resetTokenExpiry } = this.getResetTokenConfig();
        const resetToken = TokenUtil.generateResetPasswordToken(
            user.email,
            jwtSecret,
            resetTokenExpiry,
        );

        // Save reset token to database
        await this.prisma.passwordReset.create({
            data: {
                email: user.email,
                token: resetToken,
                userId: user.id,
                expiresAt: TokenUtil.getTokenExpiry(resetTokenExpiry),
            },
        });

        // Send reset password email
        try {
            await this.emailService.sendPasswordResetEmail(user.email, resetToken);
            this.logger.info(`Password reset email sent to: ${user.email}`);
        } catch (error) {
            this.logger.error(`Failed to send password reset email to ${user.email}:`, error);
            // Don't throw error to user for security reasons
        }

        this.logger.info(`Password reset requested for: ${user.email}`);

        // Return token only in development mode
        const isDevelopment = process.env.NODE_ENV === 'development';

        return {
            message: 'Password reset link has been sent to your email',
            ...(isDevelopment && {
                data: {
                    token: resetToken,
                    // Also provide direct reset link for easier testing
                    reset_link: `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`
                }
            }),
        };
    }

    /**
     * Reset password
     */
    async resetPassword(dto: ResetPasswordDto) {
        const { jwtSecret } = this.getResetTokenConfig();

        // Verify reset token
        let tokenPayload: any;
        try {
            tokenPayload = TokenUtil.verifyToken(dto.token, jwtSecret);
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        if (tokenPayload.type !== 'password-reset') {
            throw new UnauthorizedException('Invalid token type');
        }

        // Check if reset token exists in database
        const passwordReset = await this.prisma.passwordReset.findUnique({
            where: { token: dto.token },
        });

        if (!passwordReset || passwordReset.usedAt) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        // Check if token is expired
        if (passwordReset.expiresAt < new Date()) {
            throw new UnauthorizedException('Reset token has expired');
        }

        // Hash new password
        const hashedPassword = await PasswordUtil.hashPassword(dto.new_password);

        // Update password
        await this.prisma.user.update({
            where: { email: passwordReset.email },
            data: { password: hashedPassword },
        });

        // Mark token as used
        await this.prisma.passwordReset.update({
            where: { token: dto.token },
            data: { usedAt: new Date() },
        });

        // Delete all refresh tokens (force logout from all devices)
        await this.prisma.refreshToken.deleteMany({
            where: { userId: passwordReset.userId },
        });

        this.logger.info(`Password reset successful for: ${passwordReset.email}`);

        return {
            message: 'Password has been reset successfully. You can now login with your new password.',
        };
    }

    /**
     * Logout - Blacklist current token
     */
    async logout(userId: string, token: string) {
        const { accessTokenExpiry } = this.getJwtConfig();

        // Blacklist the token
        await this.prisma.blacklistedToken.create({
            data: {
                token,
                userId,
                expiresAt: TokenUtil.getTokenExpiry(accessTokenExpiry),
            },
        });

        this.logger.info(`User logged out: ${userId}`);

        return {
            message: 'Logged out successfully',
        };
    }

    /**
     * Get current user profile
     */
    async getCurrentUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                email: true,
                phoneNumber: true,
                country: true,
                city: true,
                province: true,
                district: true,
                postalCode: true,
                address: true,
                profileImage: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return {
            data: {
                id: user.id,
                first_name: user.firstName,
                last_name: user.lastName,
                username: user.username,
                email: user.email,
                phone_number: user.phoneNumber,
                country: user.country,
                city: user.city,
                province: user.province,
                district: user.district,
                postal_code: user.postalCode,
                address: user.address,
                profile_image: user.profileImage,
                role: user.role,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
            },
        };
    }

    /**
     * Update user profile
     * @param userId - User ID
     * @param dto - Update profile DTO
     * @param file - Optional profile image file
     */
    async updateProfile(
        userId: string,
        dto: UpdateProfileDto,
        file?: Express.Multer.File,
    ) {
        let profileImageUrl: string | undefined;

        // Get current user to check for existing profile image
        const currentUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { profileImage: true },
        });

        // Handle file upload if provided
        if (file) {
            this.logger.info('📤 Uploading profile image...', {
                filename: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
            });

            try {
                // Delete old profile image if exists
                if (currentUser?.profileImage) {
                    await this.localStorageService
                        .deleteImage(currentUser.profileImage)
                        .catch(() => {
                            this.logger.warn('Failed to delete old profile image');
                        });
                }

                // Upload new image using LocalStorageService
                const uploadResult = await this.localStorageService.uploadImage(
                    file,
                    'profiles',
                );

                profileImageUrl = uploadResult.url;
                this.logger.info(`✅ Profile image uploaded: ${profileImageUrl}`);
            } catch (uploadError) {
                this.logger.error('❌ Upload failed:', uploadError);
                throw new BadRequestException('Failed to upload profile image');
            }
        }

        // Log incoming data for debugging
        this.logger.info('📝 Update profile DTO:', {
            phone_number: dto.phone_number,
            country: dto.country,
            province: dto.province,
            city: dto.city,
            district: dto.district,
            postal_code: dto.postal_code,
            address: dto.address,
        });

        // Build update data - handle empty strings as null
        const updateData: any = {};

        if (dto.phone_number !== undefined) {
            updateData.phoneNumber = dto.phone_number || null;
        }
        if (dto.country !== undefined) {
            updateData.country = dto.country; // Country should always have a value (2-char code)
        }
        if (dto.province !== undefined) {
            updateData.province = dto.province || null;
        }
        if (dto.city !== undefined) {
            updateData.city = dto.city || null;
        }
        if (dto.district !== undefined) {
            updateData.district = dto.district || null;
        }
        if (dto.postal_code !== undefined) {
            updateData.postalCode = dto.postal_code || null;
        }
        if (dto.address !== undefined) {
            updateData.address = dto.address || null;
        }
        if (profileImageUrl) {
            updateData.profileImage = profileImageUrl;
        }

        this.logger.info('📝 Prisma update data:', updateData);

        // Update user in database
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                phoneNumber: true,
                address: true,
                country: true,
                city: true,
                province: true,
                district: true,
                postalCode: true,
                profileImage: true,
                updatedAt: true,
            },
        });

        return {
            message: 'Profile updated successfully',
            data: {
                id: user.id,
                phone_number: user.phoneNumber,
                address: user.address,
                country: user.country,
                city: user.city,
                province: user.province,
                district: user.district,
                postal_code: user.postalCode,
                profile_image: user.profileImage,
                updated_at: user.updatedAt,
            },
        };
    }


    /**
     * Update password
     */
    async updatePassword(userId: string, dto: UpdatePasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify old password
        const isOldPasswordValid = await PasswordUtil.comparePassword(
            dto.old_password,
            user.password,
        );

        if (!isOldPasswordValid) {
            throw new UnauthorizedException('Old password is incorrect');
        }

        // Hash new password
        const hashedPassword = await PasswordUtil.hashPassword(dto.new_password);

        // Update password
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        // Delete all refresh tokens (force logout from other devices)
        await this.prisma.refreshToken.deleteMany({
            where: { userId },
        });

        this.logger.info(`Password updated for user: ${user.email}`);

        return {
            message: 'Password updated successfully',
        };
    }

    /**
     * Delete profile image
     */
    async deleteProfileImage(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { profileImage: true },
        });

        if (!user?.profileImage) {
            throw new NotFoundException('No profile image to delete');
        }

        // Delete file from storage
        try {
            await this.localStorageService.deleteImage(user.profileImage);
        } catch (error) {
            this.logger.warn('Failed to delete profile image from storage:', error);
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { profileImage: null },
        });

        return {
            message: 'Profile image deleted successfully',
        };
    }
}