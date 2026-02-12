// src/analytics/dto/analytics.dto.ts

import { z } from 'zod';

export const GetAnalyticsOverviewSchema = z.object({
    period: z.enum(['today', 'week', 'month', 'year']).optional().default('month'),
});

export const GetRevenueAnalyticsSchema = z.object({
    period: z.enum(['7days', '30days', '90days', '12months']).optional().default('30days'),
    currency: z.enum(['IDR', 'USD', 'ALL']).optional().default('ALL'),
});

export const GetProductAnalyticsSchema = z.object({
    limit: z.coerce.number().min(1).max(50).optional().default(10),
    sortBy: z.enum(['sales', 'revenue', 'views', 'rating']).optional().default('sales'),
});

export const AiInsightQuerySchema = z.object({
    query: z.string().min(5).max(500),
    context: z.enum(['sales', 'products', 'customers', 'general']).optional().default('general'),
});

export type GetAnalyticsOverviewDto = z.infer<typeof GetAnalyticsOverviewSchema>;
export type GetRevenueAnalyticsDto = z.infer<typeof GetRevenueAnalyticsSchema>;
export type GetProductAnalyticsDto = z.infer<typeof GetProductAnalyticsSchema>;
export type AiInsightQueryDto = z.infer<typeof AiInsightQuerySchema>;