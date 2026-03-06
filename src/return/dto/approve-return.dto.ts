// src/return/dto/approve-return.dto.ts

import { z } from 'zod';

export const ApproveReturnSchema = z.object({
    admin_notes: z.string().max(500).optional(),
});

export type ApproveReturnDto = z.infer<typeof ApproveReturnSchema>;