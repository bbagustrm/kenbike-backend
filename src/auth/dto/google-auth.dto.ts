import { z } from 'zod';

export const GoogleAuthSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    picture: z.string().optional(),
    providerId: z.string().min(1),
});

export type GoogleAuthDto = z.infer<typeof GoogleAuthSchema>;