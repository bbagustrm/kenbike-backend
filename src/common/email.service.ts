// src/common/email.service.ts
// Place this file in: src/common/email.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter: Transporter | null;
    private readonly from: string;
    private readonly fromName: string;
    private readonly isConfigured: boolean;

    constructor(
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        const host = this.configService.get<string>('MAIL_HOST');
        const port = this.configService.get<number>('MAIL_PORT');
        const user = this.configService.get<string>('MAIL_USER');
        const password = this.configService.get<string>('MAIL_PASSWORD');
        this.from = this.configService.get<string>('MAIL_FROM') || user || 'noreply@app.com';
        this.fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'Your App';

        if (!host || !user || !password) {
            this.logger.warn('⚠️ Email configuration incomplete. Email sending will be disabled.');
            this.transporter = null;
            this.isConfigured = false;
            return;
        }

        this.isConfigured = true;

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // true for 465, false for other ports
            auth: {
                user,
                pass: password,
            },
        });

        // Verify connection
        this.transporter.verify((error, success) => {
            if (error) {
                this.logger.error('❌ Email service connection failed:', error);
            } else {
                this.logger.info('✅ Email service ready');
            }
        });
    }

    async sendPasswordResetEmail(email: string, token: string): Promise<void> {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
        const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

        const mailOptions = {
            from: `"${this.fromName}" <${this.from}>`,
            to: email,
            subject: 'Password Reset Request',
            html: this.getPasswordResetTemplate(resetUrl),
        };

        try {
            if (!this.transporter) {
                // Development mode: log token instead of sending email
                this.logger.warn('📧 Email not configured. Reset token:', token);
                this.logger.warn('📧 Reset URL:', resetUrl);
                return;
            }

            await this.transporter.sendMail(mailOptions);
            this.logger.info(`✅ Password reset email sent to: ${email}`);
        } catch (error) {
            this.logger.error('❌ Failed to send password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
    }

    async sendWelcomeEmail(email: string, name: string): Promise<void> {
        const mailOptions = {
            from: `"${this.fromName}" <${this.from}>`,
            to: email,
            subject: 'Welcome to Our Platform!',
            html: this.getWelcomeTemplate(name),
        };

        try {
            if (!this.transporter) {
                this.logger.warn('📧 Email not configured. Welcome email skipped.');
                return;
            }

            await this.transporter.sendMail(mailOptions);
            this.logger.info(`✅ Welcome email sent to: ${email}`);
        } catch (error) {
            this.logger.error('❌ Failed to send welcome email:', error);
            // Don't throw error for welcome email
        }
    }

    private getPasswordResetTemplate(resetUrl: string): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reset Your Password</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td align="center" style="padding: 40px 0;">
                            <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <!-- Header -->
                                <tr>
                                    <td style="padding: 40px 40px 20px; text-align: center;">
                                        <h1 style="margin: 0; color: #333333; font-size: 24px; font-weight: bold;">
                                            Reset Your Password
                                        </h1>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 20px 40px;">
                                        <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.5;">
                                            We received a request to reset your password. Click the button below to create a new password:
                                        </p>
                                        
                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td align="center" style="padding: 20px 0;">
                                                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 40px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
                                                        Reset Password
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                                            Or copy and paste this link into your browser:
                                        </p>
                                        <p style="margin: 10px 0; color: #007bff; font-size: 14px; word-break: break-all;">
                                            ${resetUrl}
                                        </p>
                                        
                                        <p style="margin: 30px 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                                            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #eeeeee;">
                                        <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                                            © 2024 ${this.fromName}. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;
    }

    private getWelcomeTemplate(name: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome!</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td align="center" style="padding: 40px 0;">
                            <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <tr>
                                    <td style="padding: 40px; text-align: center;">
                                        <h1 style="margin: 0 0 20px; color: #333333; font-size: 28px; font-weight: bold;">
                                            Welcome to ${this.fromName}!
                                        </h1>
                                        <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.5;">
                                            Hi ${name},
                                        </p>
                                        <p style="margin: 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                                            Thank you for registering. We're excited to have you on board!
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;
    }
}