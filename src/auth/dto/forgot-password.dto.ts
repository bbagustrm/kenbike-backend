import { z } from 'zod';

export const ForgotPasswordSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .max(255, 'Email must not exceed 255 characters'),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;