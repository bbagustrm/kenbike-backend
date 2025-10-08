import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    status: string;
    code: number;
    message?: string;
    data?: T;
    meta?: any;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const statusCode = response.statusCode;

        return next.handle().pipe(
            map((data) => {
                // Jika data sudah dalam format response (dari controller), return as-is
                if (data && typeof data === 'object' && 'status' in data) {
                    return data;
                }

                // Transform data ke format standar
                return {
                    status: 'success',
                    code: statusCode,
                    ...(data?.message && { message: data.message }),
                    ...(data?.data !== undefined && { data: data.data }),
                    ...(data?.meta && { meta: data.meta }),
                    // Jika data bukan object dengan message/data, langsung masukkan ke data
                    ...(!data?.message && !data?.data && data !== undefined && { data }),
                };
            }),
        );
    }
}