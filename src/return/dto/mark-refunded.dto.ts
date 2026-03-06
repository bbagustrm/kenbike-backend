// src/return/dto/mark-refunded.dto.ts

import { z } from 'zod';

export const MarkRefundedSchema = z.object({
    refund_method: z.string().min(2, 'Refund method is required').max(100),
    refund_proof: z.string().url('Proof URL must be a valid URL'),
    refund_notes: z.string().max(500).optional(),
});

export type MarkRefundedDto = z.infer<typeof MarkRefundedSchema>;