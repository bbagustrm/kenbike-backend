// src/invoice/invoice.controller.ts

import {
    Controller,
    Get,
    Param,
    Res,
    UseGuards,
    Req,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../common/prisma.service';

@Controller('invoice')
@UseGuards(JwtAuthGuard)
export class InvoiceController {
    constructor(
        private readonly invoiceService: InvoiceService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Download Invoice PDF
     * GET /api/v1/invoice/:orderNumber
     */
    @Get(':orderNumber')
    async downloadInvoice(
        @Param('orderNumber') orderNumber: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const user = req.user as { id: string; role: string };
        await this.checkOrderAccess(orderNumber, user);

        const pdfBuffer = await this.invoiceService.generateInvoicePDF(orderNumber);

        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            select: { invoiceNumber: true },
        });

        const filename = order?.invoiceNumber
            ? `${order.invoiceNumber}.pdf`
            : `Invoice-${orderNumber}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        });

        res.send(pdfBuffer);
    }

    /**
     * Preview Invoice PDF (inline display)
     * GET /api/v1/invoice/:orderNumber/preview
     */
    @Get(':orderNumber/preview')
    async previewInvoice(
        @Param('orderNumber') orderNumber: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const user = req.user as { id: string; role: string };
        await this.checkOrderAccess(orderNumber, user);

        const pdfBuffer = await this.invoiceService.generateInvoicePDF(orderNumber);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Invoice-${orderNumber}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });

        res.send(pdfBuffer);
    }

    /**
     * Download Shipping Label PDF
     * GET /api/v1/invoice/:orderNumber/shipping-label
     *
     * For DOMESTIC orders: Returns JSON with URL for frontend to open in new tab
     * For INTERNATIONAL orders: Returns PDF buffer
     */
    @Get(':orderNumber/shipping-label')
    async downloadShippingLabel(
        @Param('orderNumber') orderNumber: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const user = req.user as { id: string; role: string };
        await this.checkOrderAccess(orderNumber, user);

        const result = await this.invoiceService.generateShippingLabelPDF(orderNumber);

        // If result is URL (Biteship), return JSON for frontend to open in new tab
        if (result.type === 'url') {
            return res.json({
                type: 'url',
                url: result.data,
                message: 'Open this URL in a new tab to view/print the shipping label',
            });
        }

        // Otherwise, send PDF buffer
        const pdfBuffer = result.data as Buffer;
        const filename = `ShippingLabel-${orderNumber}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        });

        res.send(pdfBuffer);
    }

    /**
     * Preview Shipping Label PDF (inline display)
     * GET /api/v1/invoice/:orderNumber/shipping-label/preview
     */
    @Get(':orderNumber/shipping-label/preview')
    async previewShippingLabel(
        @Param('orderNumber') orderNumber: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const user = req.user as { id: string; role: string };
        await this.checkOrderAccess(orderNumber, user);

        const result = await this.invoiceService.generateShippingLabelPDF(orderNumber);

        // If result is URL (Biteship), return JSON for frontend to open in new tab
        if (result.type === 'url') {
            return res.json({
                type: 'url',
                url: result.data,
                message: 'Open this URL in a new tab to view/print the shipping label',
            });
        }

        const pdfBuffer = result.data as Buffer;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="ShippingLabel-${orderNumber}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });

        res.send(pdfBuffer);
    }

    /**
     * Admin: Download any invoice
     * GET /api/v1/invoice/admin/:orderNumber
     */
    @Get('admin/:orderNumber')
    @UseGuards(RolesGuard)
    @Roles('ADMIN', 'OWNER')
    async adminDownloadInvoice(
        @Param('orderNumber') orderNumber: string,
        @Res() res: Response,
    ) {
        const pdfBuffer = await this.invoiceService.generateInvoicePDF(orderNumber);

        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            select: { invoiceNumber: true },
        });

        const filename = order?.invoiceNumber
            ? `${order.invoiceNumber}.pdf`
            : `Invoice-${orderNumber}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length,
        });

        res.send(pdfBuffer);
    }

    /**
     * Admin: Download any shipping label
     * GET /api/v1/invoice/admin/:orderNumber/shipping-label
     */
    @Get('admin/:orderNumber/shipping-label')
    @UseGuards(RolesGuard)
    @Roles('ADMIN', 'OWNER')
    async adminDownloadShippingLabel(
        @Param('orderNumber') orderNumber: string,
        @Res() res: Response,
    ) {
        const result = await this.invoiceService.generateShippingLabelPDF(orderNumber);

        // If result is URL (Biteship), return JSON
        if (result.type === 'url') {
            return res.json({
                type: 'url',
                url: result.data,
                message: 'Open this URL in a new tab to view/print the shipping label',
            });
        }

        const pdfBuffer = result.data as Buffer;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="ShippingLabel-${orderNumber}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });

        res.send(pdfBuffer);
    }

    /**
     * Check if user has access to order
     */
    private async checkOrderAccess(
        orderNumber: string,
        user: { id: string; role: string },
    ): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            select: { userId: true },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (user.role === 'ADMIN' || user.role === 'OWNER') {
            return;
        }

        if (order.userId !== user.id) {
            throw new ForbiddenException('You do not have access to this order');
        }
    }
}