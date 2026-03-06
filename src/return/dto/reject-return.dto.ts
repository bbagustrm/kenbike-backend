// src/return/dto/reject-return.dto.ts

import { z } from 'zod';

export const RejectReturnSchema = z.object({
    admin_notes: z.string().min(10, 'Rejection reason is required').max(500),
});

export type RejectReturnDto = z.infer<typeof RejectReturnSchema>;