export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    code: number;
    message?: string;
    data?: T;
    meta?: PaginationMeta;
    errors?: ValidationError[];
}

export interface ValidationError {
    field: string;
    message: string;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}