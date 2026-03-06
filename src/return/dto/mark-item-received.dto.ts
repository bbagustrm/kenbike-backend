// src/return/dto/mark-item-received.dto.ts

import { z } from 'zod';

export const MarkItemReceivedSchema = z.object({
    received_notes: z.string().max(500).optional(),
});

export type MarkItemReceivedDto = z.infer<typeof MarkItemReceivedSchema>;