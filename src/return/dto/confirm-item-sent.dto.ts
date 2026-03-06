// src/return/dto/confirm-item-sent.dto.ts

import { z } from 'zod';

export const ConfirmItemSentSchema = z.object({
    return_courier: z.string().min(2, 'Courier name is required').max(50),
    return_tracking_number: z.string().min(3, 'Tracking number is required').max(100),
});

export type ConfirmItemSentDto = z.infer<typeof ConfirmItemSentSchema>;