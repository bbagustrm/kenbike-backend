import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    NotFoundException,
    Inject,
    InternalServerErrorException,
    BadRequestException,
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
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { GoogleUser } from './strategies/google.strategy';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { LocalStorageService } from '../common/storage/local-storage.service';
import { Request } from 'express';
import { EmailService } from '../common/email.service';
import { LoginAttemptGuard } from '../common/guards/login-attempt.guard';

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

    // ============================================
    // PRIVATE HELPER METHODS
    // ============================================

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
     * Generate unique username from email or name
     */
    private async generateUniqueUsername(
        email: string,
        firstName: string,
        lastName: string,
    ): Promise<string> {
        let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

        if (baseUsername.length < 3) {
            baseUsername = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        }

        baseUsername = baseUsername.substring(0, 25);

        let username = baseUsername;
        let counter = 1;

        while (await this.prisma.user.findUnique({ where: { username } })) {
            username = `${baseUsername}${counter}`;
            counter++;
        }

        return username;
    }

    /**
     * Generate 6-digit OTP
     */
    private generateOtp(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Create and send OTP to email
     */
    private async createAndSendOtp(email: string, locale: 'id' | 'en' = 'id'): Promise<void> {
        const otp = this.generateOtp();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Invalidate old OTPs for this email
        await this.prisma.emailVerification.updateMany({
            where: {
                email,
                usedAt: null,
            },
            data: { usedAt: new Date() },
        });

        // Create new OTP record
        await this.prisma.emailVerification.create({
            data: {
                email,
                otp,
                expiresAt,
            },
        });

        // Send OTP via email
        await this.emailService.sendOtpEmail(email, otp, locale);

        this.logger.info(`📧 OTP sent to: ${email}`);
    }

    // ============================================
    // AUTHENTICATION METHODS
    // ============================================

    /**
     * Register new user (with OTP verification)
     */
    async register(dto: RegisterDto) {
        // Check if email already exists
        const existingEmail = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existingEmail) {
            // If user exists but not verified, allow resend OTP
            if (!existingEmail.isEmailVerified && existingEmail.provider === 'local') {
                await this.createAndSendOtp(existingEmail.email);

                return {
                    message: 'Email already registered but not verified. New OTP has been sent.',
                    data: {
                        email: existingEmail.email,
                        requires_verification: true,
                    },
                };
            }

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

        // Create user with isEmailVerified: false
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
                provider: 'local',
                isProfileComplete: true,
                isEmailVerified: false, // 👈 NEW: Not verified yet
            },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
            },
        });

        // Generate and send OTP
        await this.createAndSendOtp(user.email);

        this.logger.info(`📝 New user registered (pending verification): ${user.email}`);

        return {
            message: 'Registration successful. Please verify your email with the OTP sent.',
            data: {
                ...user,
                requires_verification: true,
            },
        };
    }

    /**
     * Verify OTP and activate account
     */
    async verifyOtp(dto: VerifyOtpDto) {
        // Find valid OTP
        const verification = await this.prisma.emailVerification.findFirst({
            where: {
                email: dto.email,
                otp: dto.otp,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        if (!verification) {
            throw new BadRequestException({
                message: 'Invalid or expired OTP',
                error: 'OTP_INVALID',
            });
        }

        // Find user
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.isEmailVerified) {
            return {
                message: 'Email already verified',
                data: { email: user.email },
            };
        }

        // Transaction: Mark OTP as used & verify user email
        await this.prisma.$transaction([
            this.prisma.emailVerification.update({
                where: { id: verification.id },
                data: { usedAt: new Date() },
            }),
            this.prisma.user.update({
                where: { email: dto.email },
                data: { isEmailVerified: true },
            }),
        ]);

        this.logger.info(`✅ Email verified: ${dto.email}`);

        return {
            message: 'Email verified successfully. You can now login.',
            data: { email: dto.email },
        };
    }

    /**
     * Resend OTP for email verification
     */
    async resendOtp(dto: ResendOtpDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        // Security: don't reveal if email exists
        if (!user) {
            return { message: 'If the email exists and is not verified, OTP has been sent.' };
        }

        // Check if already verified
        if (user.isEmailVerified) {
            throw new BadRequestException({
                message: 'Email is already verified',
                error: 'ALREADY_VERIFIED',
            });
        }

        // Check if user registered via Google (no OTP needed)
        if (user.provider === 'google') {
            throw new BadRequestException({
                message: 'Google accounts are automatically verified',
                error: 'GOOGLE_ACCOUNT',
            });
        }

        // Rate limit: check last OTP sent time (1 minute cooldown)
        const lastOtp = await this.prisma.emailVerification.findFirst({
            where: { email: dto.email },
            orderBy: { createdAt: 'desc' },
        });

        if (lastOtp) {
            const timeSinceLastOtp = Date.now() - lastOtp.createdAt.getTime();
            const cooldownMs = 60 * 1000; // 1 minute

            if (timeSinceLastOtp < cooldownMs) {
                const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastOtp) / 1000);
                throw new BadRequestException({
                    message: `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
                    error: 'OTP_COOLDOWN',
                    retry_after: remainingSeconds,
                });
            }
        }

        // Send new OTP
        await this.createAndSendOtp(dto.email);

        return {
            message: 'OTP sent successfully. Please check your email.',
            data: { email: dto.email },
        };
    }

    /**
     * Login user with email and password
     */
    async login(dto: LoginDto, req: Request) {
        const ip = this.getClientIp(req);

        // Find user by email
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user || user.deletedAt) {
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

        // 👇 NEW: Check if email is verified (only for local accounts)
        if (!user.isEmailVerified && user.provider === 'local') {
            throw new UnauthorizedException({
                statusCode: 401,
                message: 'Please verify your email first',
                error: 'Email Not Verified',
                requires_verification: true,
                email: user.email,
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

        // Check if user registered via Google (no password)
        if (user.provider === 'google' && !user.password) {
            throw new UnauthorizedException({
                statusCode: 401,
                message: 'This account uses Google Sign-In. Please login with Google.',
                error: 'Google Account',
            });
        }

        // Check if user has no password (edge case)
        if (!user.password) {
            throw new UnauthorizedException({
                statusCode: 401,
                message: 'Invalid email or password',
                error: 'Unauthorized',
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

        // Login successful - Reset attempts
        this.loginAttemptGuard.resetAttempts(ip, dto.email);

        // Generate tokens
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

        this.logger.info(`✅ User logged in: ${user.email} from ${ip}`);

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

    // ============================================
    // GOOGLE OAUTH METHODS
    // ============================================

    /**
     * Handle Google OAuth login/register
     * Google users are auto-verified (isEmailVerified: true)
     */
    async googleAuth(googleUser: GoogleUser) {
        const { email, firstName, lastName, picture, providerId } = googleUser;

        let user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            if (user.deletedAt) {
                throw new UnauthorizedException('This account has been deleted');
            }

            if (!user.isActive) {
                throw new UnauthorizedException('Account has been suspended');
            }

            if (user.provider !== 'google') {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        provider: 'google',
                        providerId: providerId,
                        profileImage: user.profileImage || picture,
                        isEmailVerified: true, // 👈 Auto-verify on Google link
                    },
                });

                this.logger.info(`🔗 Linked Google account for existing user: ${email}`);
            } else {
                if (picture && !user.profileImage) {
                    await this.prisma.user.update({
                        where: { id: user.id },
                        data: { profileImage: picture },
                    });
                }
            }
        } else {
            const username = await this.generateUniqueUsername(email, firstName, lastName);

            user = await this.prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    username,
                    password: null,
                    provider: 'google',
                    providerId: providerId,
                    profileImage: picture,
                    role: 'USER',
                    isActive: true,
                    isEmailVerified: true, // 👈 Google users are auto-verified
                },
            });

            this.logger.info(`📝 New user registered via Google: ${email}`);
        }

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

        this.logger.info(`✅ Google auth successful for: ${email}`);

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                first_name: user.firstName,
                last_name: user.lastName,
                profile_image: user.profileImage,
                provider: user.provider,
                is_profile_complete: user.isProfileComplete,
                is_email_verified: user.isEmailVerified,
                phone_number: user.phoneNumber,
                country: user.country,
            },
        };
    }

    // ============================================
    // TOKEN METHODS
    // ============================================

    /**
     * Refresh access token
     */
    async refreshToken(req: Request) {
        const { jwtSecret, accessTokenExpiry } = this.getJwtConfig();

        const refreshTokenValue = req.cookies?.refresh_token;

        if (!refreshTokenValue) {
            throw new UnauthorizedException('Refresh token not found in cookies');
        }

        let payload: JwtPayload;
        try {
            payload = TokenUtil.verifyToken<JwtPayload>(refreshTokenValue, jwtSecret);
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
            where: { token: refreshTokenValue },
        });

        if (!refreshTokenRecord) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        if (refreshTokenRecord.expiresAt < new Date()) {
            await this.prisma.refreshToken.delete({
                where: { token: refreshTokenValue },
            });
            throw new UnauthorizedException('Refresh token has expired');
        }

        const accessToken = TokenUtil.generateAccessToken(payload, jwtSecret, accessTokenExpiry);

        return {
            message: 'Token refreshed successfully',
            data: {
                access_token: accessToken,
                token_type: 'Bearer',
                expires_in: 900,
            },
        };
    }

    /**
     * Logout - Blacklist current token
     */
    async logout(userId: string, token: string) {
        const { accessTokenExpiry } = this.getJwtConfig();

        await this.prisma.blacklistedToken.create({
            data: {
                token,
                userId,
                expiresAt: TokenUtil.getTokenExpiry(accessTokenExpiry),
            },
        });

        this.logger.info(`🚪 User logged out: ${userId}`);

        return {
            message: 'Logged out successfully',
        };
    }

    // ============================================
    // PASSWORD RESET METHODS
    // ============================================

    /**
     * Forgot password - Send reset email
     */
    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            this.logger.warn(`Password reset requested for non-existent email: ${dto.email}`);
            return {
                message: 'Password reset link has been sent to your email',
            };
        }

        if (user.provider === 'google' && !user.password) {
            this.logger.warn(`Password reset requested for Google-only account: ${dto.email}`);
            return {
                message: 'Password reset link has been sent to your email',
            };
        }

        const { jwtSecret, resetTokenExpiry } = this.getResetTokenConfig();
        const resetToken = TokenUtil.generateResetPasswordToken(
            user.email,
            jwtSecret,
            resetTokenExpiry,
        );

        await this.prisma.passwordReset.create({
            data: {
                email: user.email,
                token: resetToken,
                userId: user.id,
                expiresAt: TokenUtil.getTokenExpiry(resetTokenExpiry),
            },
        });

        try {
            await this.emailService.sendPasswordResetEmail(user.email, resetToken);
            this.logger.info(`📧 Password reset email sent to: ${user.email}`);
        } catch (error) {
            this.logger.error(`❌ Failed to send password reset email to ${user.email}:`, error);
        }

        this.logger.info(`🔑 Password reset requested for: ${user.email}`);

        const isDevelopment = process.env.NODE_ENV === 'development';

        return {
            message: 'Password reset link has been sent to your email',
            ...(isDevelopment && {
                data: {
                    token: resetToken,
                    reset_link: `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`,
                },
            }),
        };
    }

    /**
     * Reset password
     */
    async resetPassword(dto: ResetPasswordDto) {
        const { jwtSecret } = this.getResetTokenConfig();

        let tokenPayload: any;
        try {
            tokenPayload = TokenUtil.verifyToken(dto.token, jwtSecret);
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        if (tokenPayload.type !== 'password-reset') {
            throw new UnauthorizedException('Invalid token type');
        }

        const passwordReset = await this.prisma.passwordReset.findUnique({
            where: { token: dto.token },
        });

        if (!passwordReset || passwordReset.usedAt) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        if (passwordReset.expiresAt < new Date()) {
            throw new UnauthorizedException('Reset token has expired');
        }

        const hashedPassword = await PasswordUtil.hashPassword(dto.new_password);

        await this.prisma.user.update({
            where: { email: passwordReset.email },
            data: {
                password: hashedPassword,
            },
        });

        await this.prisma.passwordReset.update({
            where: { token: dto.token },
            data: { usedAt: new Date() },
        });

        await this.prisma.refreshToken.deleteMany({
            where: { userId: passwordReset.userId },
        });

        this.logger.info(`✅ Password reset successful for: ${passwordReset.email}`);

        return {
            message: 'Password has been reset successfully. You can now login with your new password.',
        };
    }

    // ============================================
    // PROFILE METHODS
    // ============================================

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
                provider: true,
                isProfileComplete: true,
                isEmailVerified: true, // 👈 Include this
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
                provider: user.provider,
                is_profile_complete: user.isProfileComplete,
                is_email_verified: user.isEmailVerified, // 👈 Include this
                created_at: user.createdAt,
                updated_at: user.updatedAt,
            },
        };
    }

    /**
     * Update user profile
     */
    async updateProfile(
        userId: string,
        dto: UpdateProfileDto,
        file?: Express.Multer.File,
    ) {
        let profileImageUrl: string | undefined;

        const currentUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { profileImage: true },
        });

        if (file) {
            this.logger.info('📤 Uploading profile image...', {
                filename: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
            });

            try {
                if (currentUser?.profileImage) {
                    await this.localStorageService
                        .deleteImage(currentUser.profileImage)
                        .catch(() => {
                            this.logger.warn('Failed to delete old profile image');
                        });
                }

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

        const updateData: any = {};

        if (dto.phone_number !== undefined) {
            updateData.phoneNumber = dto.phone_number || null;
        }
        if (dto.country !== undefined) {
            updateData.country = dto.country;
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
     * Update password (with email notification)
     */
    async updatePassword(userId: string, dto: UpdatePasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.password) {
            throw new BadRequestException(
                'Cannot update password for Google-only accounts. Please use "Set Password" instead.',
            );
        }

        const isOldPasswordValid = await PasswordUtil.comparePassword(
            dto.old_password,
            user.password,
        );

        if (!isOldPasswordValid) {
            throw new UnauthorizedException('Old password is incorrect');
        }

        const hashedPassword = await PasswordUtil.hashPassword(dto.new_password);

        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        await this.prisma.refreshToken.deleteMany({
            where: { userId },
        });

        // 👇 NEW: Send password changed notification email
        try {
            await this.emailService.sendPasswordChangedEmail(user.email, 'id');
            this.logger.info(`📧 Password changed email sent to: ${user.email}`);
        } catch (error) {
            this.logger.error(`❌ Failed to send password changed email:`, error);
        }

        this.logger.info(`🔑 Password updated for user: ${user.email}`);

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

    /**
     * Complete user profile (for Google OAuth users)
     */
    async completeProfile(userId: string, dto: CompleteProfileDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                phoneNumber: dto.phone_number,
                country: dto.country,
                province: dto.province,
                city: dto.city,
                district: dto.district || null,
                postalCode: dto.postal_code,
                address: dto.address,
                isProfileComplete: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                email: true,
                phoneNumber: true,
                country: true,
                province: true,
                city: true,
                district: true,
                postalCode: true,
                address: true,
                profileImage: true,
                role: true,
                provider: true,
                isProfileComplete: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        this.logger.info(`✅ Profile completed for user: ${user.email}`);

        return {
            message: 'Profile completed successfully',
            data: {
                id: updatedUser.id,
                first_name: updatedUser.firstName,
                last_name: updatedUser.lastName,
                username: updatedUser.username,
                email: updatedUser.email,
                phone_number: updatedUser.phoneNumber,
                country: updatedUser.country,
                province: updatedUser.province,
                city: updatedUser.city,
                district: updatedUser.district,
                postal_code: updatedUser.postalCode,
                address: updatedUser.address,
                profile_image: updatedUser.profileImage,
                role: updatedUser.role,
                provider: updatedUser.provider,
                is_profile_complete: updatedUser.isProfileComplete,
                is_email_verified: updatedUser.isEmailVerified,
                created_at: updatedUser.createdAt,
                updated_at: updatedUser.updatedAt,
            },
        };
    }

    /**
     * Check if user profile is complete
     */
    async checkProfileComplete(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                isProfileComplete: true,
                isEmailVerified: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return {
            data: {
                is_profile_complete: user.isProfileComplete,
                is_email_verified: user.isEmailVerified,
            },
        };
    }
}