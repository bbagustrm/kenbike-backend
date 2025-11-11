import {
    Controller,
    Post,
    Body,
    Headers,
    BadRequestException,
    UnauthorizedException,
} from '@nestjs/common';
import { BiteshipWebhookService } from './biteship-webhook.service';

@Controller('webhooks/biteship')
export class BiteshipWebhookController {
    constructor(
        private readonly webhookService: BiteshipWebhookService,
    ) {}

    /**
     * POST /webhooks/biteship/order-status
     * Receive order status updates from Biteship
     */
    @Post('order-status')
    async handleOrderStatus(
        @Body() payload: any,
        @Headers('x-biteship-signature') signature?: string,
    ) {
        // Verify webhook signature (if configured)
        if (!this.webhookService.verifyWebhookSignature(payload, signature)) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        // Validate event type
        if (payload.event !== 'order.status') {
            throw new BadRequestException('Invalid event type');
        }

        // Process the webhook
        return this.webhookService.handleOrderStatusUpdate(payload);
    }

    /**
     * POST /webhooks/biteship/order-price
     * Receive price updates from Biteship (when actual weight differs)
     */
    @Post('order-price')
    async handleOrderPrice(
        @Body() payload: any,
        @Headers('x-biteship-signature') signature?: string,
    ) {
        if (!this.webhookService.verifyWebhookSignature(payload, signature)) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        if (payload.event !== 'order.price') {
            throw new BadRequestException('Invalid event type');
        }

        return this.webhookService.handleOrderPriceUpdate(payload);
    }

    /**
     * POST /webhooks/biteship/order-waybill
     * Receive waybill ID updates from Biteship
     */
    @Post('order-waybill')
    async handleOrderWaybill(
        @Body() payload: any,
        @Headers('x-biteship-signature') signature?: string,
    ) {
        if (!this.webhookService.verifyWebhookSignature(payload, signature)) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        if (payload.event !== 'order.waybill_id') {
            throw new BadRequestException('Invalid event type');
        }

        return this.webhookService.handleOrderWaybillUpdate(payload);
    }
}