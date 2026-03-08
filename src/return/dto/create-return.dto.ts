// src/return/dto/create-return.dto.ts

import { z } from 'zod';

export const CreateReturnSchema = z.object({
    order_number: z.string().min(1, 'Order number is required'),
    reason: z.enum([
        'DAMAGED_ITEM',
        'WRONG_ITEM',
        'NOT_AS_DESCRIBED',
        'MISSING_PARTS',
        'OTHER',
    ]),
    description: z.string()
        .min(20, 'Description must be at least 20 characters')
        .max(1000, 'Description must not exceed 1000 characters'),
    refund_bank_name: z.string().min(2).max(100),
    refund_account_number: z.string().min(5).max(50),
    refund_account_name: z.string().min(2).max(100),
});

export type CreateReturnDto = z.infer<typeof CreateReturnSchema>;