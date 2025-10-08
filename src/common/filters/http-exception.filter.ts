import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {ZodError} from "zod";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errors: any[] | undefined;

        // Handle Zod Validation Errors
        if (exception instanceof ZodError) {
            status = HttpStatus.BAD_REQUEST;
            message = 'Validation failed';
            errors = exception.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            }));
        }
        // Handle NestJS HTTP Exceptions
        else if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                const responseObj = exceptionResponse as any;
                message = responseObj.message || message;
                errors = responseObj.errors;
            }
        }
        // Handle Other Errors
        else if (exception instanceof Error) {
            message = exception.message;
        }

        response.status(status).json({
            status: 'error',
            code: status,
            message,
            ...(errors && { errors }),
        });
    }
}