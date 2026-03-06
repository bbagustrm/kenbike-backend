// src/return/dto/query-returns.dto.ts

import { z } from 'zod';

export const QueryReturnsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
    status: z.enum([
        'REQUESTED',
        'APPROVED',
        'REJECTED',
        'ITEM_SENT',
        'ITEM_RECEIVED',
        'REFUNDED',
        'CANCELLED',
    ]).optional(),
    search: z.string().optional(),
});

export type QueryReturnsDto = z.infer<typeof QueryReturnsSchema>;