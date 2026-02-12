// src/payment/payment.controller.ts

import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
    CreatePaymentSchema,
    CreatePaymentDto,
    CapturePayPalPaymentSchema,
    CapturePayPalPaymentDto,
} from './dto/payment.dto';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
    constructor(
        private paymentService: PaymentService,
        private validationService: ValidationService,
    ) {}

    /**
     * POST /payment/create
     * Create payment for an order
     */
    @Post('create')
    async createPayment(
        @CurrentUser('id') userId: string,
        @Body() body: any,
    ) {
        const dto = this.validationService.validate<CreatePaymentDto>(
            CreatePaymentSchema,
            body,
        );

        return this.paymentService.createPayment(userId, dto);
    }

    /**
     * POST /payment/paypal/capture
     * Capture PayPal payment after user approval
     */
    @Post('paypal/capture')
    async capturePayPalPayment(
        @CurrentUser('id') userId: string,
        @Body() body: any,
    ) {
        const dto = this.validationService.validate<CapturePayPalPaymentDto>(
            CapturePayPalPaymentSchema,
            body,
        );

        return this.paymentService.capturePayPalPayment(userId, dto);
    }

    /**
     * GET /payment/:orderNumber/status
     * Get payment status for an order
     */
    @Get(':orderNumber/status')
    async getPaymentStatus(
        @CurrentUser('id') userId: string,
        @Param('orderNumber') orderNumber: string,
    ) {
        return this.paymentService.getPaymentStatus(userId, orderNumber);
    }
}