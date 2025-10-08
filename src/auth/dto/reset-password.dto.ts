import { z } from 'zod';

export const ResetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    new_password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*]/, 'Password must contain at least one special character (!@#$%^&*)'),
    confirm_password: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;