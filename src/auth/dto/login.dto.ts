import { z } from 'zod';

export const LoginSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .max(255, 'Email must not exceed 255 characters'),
    password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof LoginSchema>;