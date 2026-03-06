// src/return/dto/cancel-return.dto.ts

import { z } from 'zod';

export const CancelReturnSchema = z.object({
    cancel_reason: z.string().min(5).max(500).optional(),
});

export type CancelReturnDto = z.infer<typeof CancelReturnSchema>;