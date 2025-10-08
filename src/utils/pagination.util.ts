export interface PaginationParams {
    page: number;
    limit: number;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export class PaginationUtil {
    /**
     * Calculate skip value for pagination
     */
    static getSkip(page: number, limit: number): number {
        return (page - 1) * limit;
    }

    /**
     * Generate pagination metadata
     */
    static generateMeta(
        total: number,
        page: number,
        limit: number,
    ): PaginationMeta {
        const totalPages = Math.ceil(total / limit);

        return {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        };
    }

    /**
     * Validate and normalize pagination params
     */
    static validateParams(page?: number, limit?: number): PaginationParams {
        const normalizedPage = Math.max(1, page || 1);
        const normalizedLimit = Math.min(100, Math.max(1, limit || 10));

        return {
            page: normalizedPage,
            limit: normalizedLimit,
        };
    }
}