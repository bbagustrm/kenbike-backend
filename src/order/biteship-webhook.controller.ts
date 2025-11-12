// src/order/biteship-webhook.controller.ts

import {
    Controller,
    Post,
    Body,
    Headers,
    HttpCode,
    HttpStatus,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { BiteshipWebhookService } from './biteship-webhook.service';

@Controller('webhooks/biteship')
export class BiteshipWebhookController {
    constructor(
        private biteshipWebhookService: BiteshipWebhookService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * POST /api/v1/webhooks/biteship
     * Handle Biteship webhook events
     *
     * ✅ FIXED: Return plain text "OK" for Biteship validation
     */
    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Body() payload: any,
        @Headers('x-biteship-signature') signature?: string,
        @Res() res: Response,
    ) {
        try {
            // ✅ Handle Biteship ping / test (body kosong)
            if (!payload || Object.keys(payload).length === 0) {
                this.logger.info('📨 Biteship webhook test/ping received');
                res.type('text/plain').send('OK');
                return;
            }

            this.logger.info('📨 Biteship webhook received', {
                orderId: payload?.order_id,
                status: payload?.status,
                signature: signature ? 'present' : 'missing',
            });

            // ✅ Masih lanjut proses normal
            await this.biteshipWebhookService.processWebhook(payload);

            res.type('text/plain').send('OK');
        } catch (error: any) {
            this.logger.error('❌ Webhook processing failed', {
                error: error.message,
                payload,
            });
            // ✅ Tetap kirim “OK” agar Biteship tidak retry
            res.type('text/plain').send('OK');
        }
    }
}