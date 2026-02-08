// src/invoice/invoice.service.ts

import {
    Injectable,
    Inject,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from '../common/prisma.service';
import { BiteshipService } from '../order/biteship.service';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

// Company info interface
interface CompanyInfo {
    name: string;
    address: string;
    email: string;
    phone: string;
}

// Shipping label result type
export interface ShippingLabelResult {
    type: 'pdf' | 'url';
    data: Buffer | string;
}

@Injectable()
export class InvoiceService {
    private readonly companyInfo: CompanyInfo;
    private readonly assetsPath: string;
    private readonly frontendUrl: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private biteshipService: BiteshipService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.companyInfo = {
            name: this.configService.get<string>('COMPANY_NAME') || 'Kenbike',
            address: 'Mangkudipuro Street no.269 Growong Kidul Village Juwana Sub-district, Pati Regency, Central Java, Indonesia 59185',
            email: this.configService.get<string>('COMPANY_EMAIL') || 'kenbycicle@gmail.com',
            phone: this.configService.get<string>('COMPANY_PHONE') || '+6281229505919',
        };

        this.assetsPath = path.join(process.cwd(), 'assets');
        this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://kenbikestore.com';
    }

    /**
     * Generate QR Code as Buffer
     */
    private async generateQRCode(data: string, size: number = 80): Promise<Buffer> {
        return QRCode.toBuffer(data, {
            width: size,
            margin: 1,
            errorCorrectionLevel: 'M',
        });
    }

    /**
     * Get order detail URL for QR code
     */
    private getOrderDetailUrl(orderNumber: string): string {
        return `${this.frontendUrl}/user/orders/${orderNumber}`;
    }

    /**
     * Generate continuous invoice number: INV-20250001
     */
    async generateInvoiceNumber(): Promise<string> {
        const currentYear = new Date().getFullYear();

        const lastOrder = await this.prisma.order.findFirst({
            where: {
                invoiceNumber: {
                    startsWith: 'INV-',
                },
            },
            orderBy: {
                invoiceNumber: 'desc',
            },
            select: {
                invoiceNumber: true,
            },
        });

        let nextNumber = 1;

        if (lastOrder?.invoiceNumber) {
            const match = lastOrder.invoiceNumber.match(/INV-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }

        const invoiceNumber = `INV-${currentYear}${nextNumber.toString().padStart(4, '0')}`;
        return invoiceNumber;
    }

    /**
     * Assign invoice number to order when paid
     */
    async assignInvoiceNumber(orderNumber: string): Promise<string> {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.invoiceNumber) {
            return order.invoiceNumber;
        }

        const invoiceNumber = await this.generateInvoiceNumber();

        await this.prisma.order.update({
            where: { orderNumber },
            data: { invoiceNumber },
        });

        this.logger.info(`📄 Invoice number assigned: ${invoiceNumber} for order ${orderNumber}`);
        return invoiceNumber;
    }

    /**
     * Get order with full details for invoice
     */
    private async getOrderForInvoice(orderNumber: string) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            include: {
                items: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phoneNumber: true,
                    },
                },
                shippingZone: true,
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        return order;
    }

    /**
     * Format currency based on currency code
     */
    private formatCurrency(amount: number, currency: string): string {
        if (currency === 'USD') {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amount);
        }
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    }

    /**
     * Format date
     */
    private formatDate(date: Date): string {
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(date).replace(/\//g, '/');
    }

    /**
     * Get payment method icon filename (PNG format)
     */
    private getPaymentIcon(paymentMethod: string | null, paymentProvider: string | null): string | null {
        if (!paymentMethod && !paymentProvider) return null;

        const provider = (paymentProvider || paymentMethod || '').toLowerCase();
        const method = (paymentMethod || '').toUpperCase();

        // Map payment providers to PNG icon files
        const iconMap: Record<string, string> = {
            'paypal': 'ic-paypal.png',
            'gopay': 'ic-gopay.png',
            'qris': 'ic-qris.png',
            'bni': 'ic-bni.png',
            'bri': 'ic-bri.png',
            'mandiri': 'ic-mandiri.png',
            'permata': 'ic-permatabank.png',
            'cimb': 'ic-cimbniaga.png',
        };

        // Check for specific providers first
        for (const [key, icon] of Object.entries(iconMap)) {
            if (provider.includes(key)) {
                return icon;
            }
        }

        // Fallback to Midtrans for MIDTRANS_SNAP
        if (method === 'MIDTRANS_SNAP' || provider.includes('midtrans')) {
            return 'ic-midtrans.png';
        }

        return null;
    }

    /**
     * Generate Invoice PDF with QR Code
     * Layout: Payment Method (left) | QR Code (right)
     */
    async generateInvoicePDF(orderNumber: string): Promise<Buffer> {
        this.logger.info(`📄 Generating invoice PDF for order: ${orderNumber}`);

        const order = await this.getOrderForInvoice(orderNumber);

        // Ensure invoice number exists
        if (!order.invoiceNumber) {
            if (order.status === 'PAID' || order.paidAt) {
                await this.assignInvoiceNumber(orderNumber);
                const updatedOrder = await this.getOrderForInvoice(orderNumber);
                Object.assign(order, updatedOrder);
            } else {
                throw new BadRequestException(
                    'Invoice can only be generated for paid orders',
                );
            }
        }

        // Generate QR Code for order detail page
        const qrCodeBuffer = await this.generateQRCode(
            this.getOrderDetailUrl(orderNumber),
            70
        );

        // Create PDF document (A4)
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            info: {
                Title: `Invoice ${order.invoiceNumber}`,
                Author: this.companyInfo.name,
            },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));

        const pageWidth = doc.page.width;
        const margin = 40;
        const contentWidth = pageWidth - margin * 2;

        // Colors
        const greenColor = '#4a7c4e';
        const yellowColor = '#c4a000';
        const blackColor = '#000000';
        const grayColor = '#666666';

        let yPos = margin;

        // ============================================
        // HEADER - Logo
        // ============================================

        const logoPath = path.join(this.assetsPath, 'logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, margin, yPos, { width: 150 });
            yPos += 50;
        } else {
            doc.font('Helvetica-Bold')
                .fontSize(28)
                .fillColor(yellowColor)
                .text('KEN', margin, yPos, { continued: true })
                .fillColor(blackColor)
                .text(' BIKE');
            yPos += 35;
        }

        // ============================================
        // COMPANY INFO (Left) + INVOICE TITLE (Right)
        // ============================================

        const headerY = yPos;

        // Company info (left side)
        doc.font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(blackColor)
            .text(this.companyInfo.name, margin, headerY);

        doc.font('Helvetica')
            .fontSize(8)
            .fillColor(grayColor)
            .text(this.companyInfo.address, margin, headerY + 12, { width: 280 });

        doc.text(`${this.companyInfo.email}, ${this.companyInfo.phone}`, margin, headerY + 32);

        // INVOICE title (right side)
        doc.font('Helvetica-Bold')
            .fontSize(24)
            .fillColor(blackColor)
            .text('INVOICE', pageWidth - margin - 150, headerY, { width: 150, align: 'right' });

        // Date and Invoice number
        doc.font('Helvetica')
            .fontSize(9)
            .fillColor(grayColor)
            .text(this.formatDate(order.paidAt || order.createdAt), pageWidth - margin - 150, headerY + 28, { width: 150, align: 'right' })
            .text(order.invoiceNumber!, pageWidth - margin - 150, headerY + 40, { width: 150, align: 'right' });

        yPos = headerY + 60;

        // ============================================
        // SOLD TO & ADDRESS
        // ============================================

        doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(blackColor)
            .text('SOLD TO:', margin, yPos);

        doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(blackColor)
            .text('ADDRESS:', margin + 120, yPos);

        yPos += 12;

        doc.font('Helvetica-Oblique')
            .fontSize(9)
            .fillColor(blackColor)
            .text(`Name : ${order.recipientName}`, margin, yPos);

        const fullAddress = `${order.shippingAddress}, ${order.shippingCity}${order.shippingProvince ? ', ' + order.shippingProvince : ''}, ${order.shippingCountry} ${order.shippingPostalCode}`;
        doc.font('Helvetica')
            .fontSize(9)
            .text(fullAddress, margin + 120, yPos, { width: contentWidth - 120 });

        yPos += 12;
        doc.text(`Phone : ${order.recipientPhone}`, margin, yPos);

        yPos += 25;

        // ============================================
        // ITEMS TABLE
        // ============================================

        // Table header background (green)
        doc.rect(margin, yPos, contentWidth, 20)
            .fill(greenColor);

        // Table header text (white)
        doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#ffffff');

        const colSku = margin + 5;
        const colItem = margin + 70;
        const colQty = margin + 280;
        const colPrice = margin + 340;
        const colTotal = margin + 430;

        doc.text('SKU', colSku, yPos + 6);
        doc.text('ITEM', colItem, yPos + 6);
        doc.text('QTY', colQty, yPos + 6);
        doc.text('UNIT PRICE', colPrice, yPos + 6);
        doc.text('TOTAL', colTotal, yPos + 6);

        yPos += 25;

        // Table rows
        doc.font('Helvetica').fontSize(9).fillColor(blackColor);

        for (const item of order.items) {
            doc.rect(margin, yPos - 3, contentWidth, 18)
                .fill('#f9f9f9');

            doc.fillColor(blackColor)
                .text(item.sku || '-', colSku, yPos, { width: 60 })
                .text(item.productName + (item.variantName ? ` - ${item.variantName}` : ''), colItem, yPos, { width: 200 })
                .text(item.quantity.toString(), colQty, yPos, { width: 40, align: 'center' })
                .text(this.formatCurrency(item.pricePerItem, order.currency), colPrice, yPos, { width: 80, align: 'right' })
                .text(this.formatCurrency(item.subtotal, order.currency), colTotal, yPos, { width: 80, align: 'right' });

            yPos += 18;
        }

        yPos += 10;

        // ============================================
        // TOTALS (Right aligned)
        // ============================================

        const totalsX = margin + 340;
        const totalsValueX = margin + 430;

        doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(blackColor)
            .text('SUBTOTAL:', totalsX, yPos, { width: 80, align: 'right' });
        doc.font('Helvetica')
            .text(this.formatCurrency(order.subtotal, order.currency), totalsValueX, yPos, { width: 80, align: 'right' });
        yPos += 14;

        if (order.discount > 0) {
            doc.font('Helvetica-Bold')
                .text('DISCOUNT:', totalsX, yPos, { width: 80, align: 'right' });
            doc.font('Helvetica')
                .text(`-${this.formatCurrency(order.discount, order.currency)}`, totalsValueX, yPos, { width: 80, align: 'right' });
            yPos += 14;
        }

        doc.font('Helvetica-Bold')
            .text('SHIPPING:', totalsX, yPos, { width: 80, align: 'right' });
        doc.font('Helvetica')
            .text(this.formatCurrency(order.shippingCost, order.currency), totalsValueX, yPos, { width: 80, align: 'right' });
        yPos += 20;

        // Grand Total
        const currencySymbol = order.currency === 'USD' ? '$' : 'Rp';
        const totalFormatted = `${currencySymbol}${this.formatCurrency(order.total, order.currency)}${order.currency === 'IDR' ? ',00' : ''}`;

        doc.font('Helvetica-Bold')
            .fontSize(16)
            .fillColor(blackColor)
            .text(totalFormatted, margin, yPos, { width: contentWidth, align: 'right' });

        yPos += 35;

        // ============================================
        // NOTES SECTION
        // ============================================

        doc.font('Helvetica')
            .fontSize(9)
            .fillColor(grayColor)
            .text('Note:', margin, yPos);

        const notes = order.shippingNotes || '-';
        doc.font('Helvetica-Oblique')
            .fontSize(9)
            .fillColor(blackColor)
            .text(notes, margin, yPos + 12, { width: 250 });

        yPos += 50;

        // ============================================
        // PAYMENT METHOD (Left) + QR CODE (Right) - SAME ROW
        // ============================================

        const footerY = yPos;

        // Payment Method (left side)
        doc.font('Helvetica')
            .fontSize(9)
            .fillColor(grayColor)
            .text('Payment Method:', margin, footerY);

        const paymentIcon = this.getPaymentIcon(order.paymentMethod, order.paymentProvider);

        if (paymentIcon) {
            const iconPath = path.join(this.assetsPath, paymentIcon);
            if (fs.existsSync(iconPath)) {
                try {
                    // Logo only, no text
                    doc.image(iconPath, margin, footerY + 15, { height: 30 });
                } catch {
                    doc.font('Helvetica')
                        .fontSize(10)
                        .fillColor(blackColor)
                        .text('Payment Received', margin, footerY + 15);
                }
            } else {
                doc.font('Helvetica')
                    .fontSize(10)
                    .fillColor(blackColor)
                    .text('Payment Received', margin, footerY + 15);
            }
        } else {
            doc.font('Helvetica')
                .fontSize(10)
                .fillColor(blackColor)
                .text('Payment Received', margin, footerY + 15);
        }

        // QR Code (right side) - aligned with payment method
        const qrX = pageWidth - margin - 70;
        doc.image(qrCodeBuffer, qrX, footerY, { width: 70 });

        doc.font('Helvetica')
            .fontSize(7)
            .fillColor(grayColor)
            .text('Scan for order details', qrX, footerY + 72, { width: 70, align: 'center' });

        // End document
        doc.end();

        return new Promise((resolve) => {
            doc.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });
    }

    /**
     * Generate Shipping Label PDF (80x100mm thermal paper)
     * For DOMESTIC orders: Return Biteship URL for frontend to open in new tab
     * For INTERNATIONAL orders: Generate custom label with QR code and payment icon
     */
    async generateShippingLabelPDF(orderNumber: string): Promise<ShippingLabelResult> {
        this.logger.info(`📦 Generating shipping label for order: ${orderNumber}`);

        const order = await this.getOrderForInvoice(orderNumber);

        const validStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
        if (!validStatuses.includes(order.status)) {
            throw new BadRequestException(
                `Shipping label can only be generated for orders with status: ${validStatuses.join(', ')}`,
            );
        }

        // For DOMESTIC orders with Biteship, return URL for frontend to open
        if (order.shippingType === 'DOMESTIC' && order.biteshipOrderId) {
            try {
                const labelUrl = await this.biteshipService.getShippingLabel(order.biteshipOrderId);
                return {
                    type: 'url',
                    data: labelUrl,
                };
            } catch (error) {
                this.logger.warn('⚠️ Biteship label not available, generating custom label', {
                    orderNumber,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        // Generate custom thermal label (80x100mm)
        const pdfBuffer = await this.generateThermalLabel(order);
        return {
            type: 'pdf',
            data: pdfBuffer,
        };
    }

    /**
     * Generate thermal shipping label (80x100mm) with QR Code and Payment Icon
     */
    private async generateThermalLabel(order: Awaited<ReturnType<typeof this.getOrderForInvoice>>): Promise<Buffer> {
        // 80mm x 100mm in points (1mm = 2.83465 points)
        const widthMM = 80;
        const heightMM = 100;
        const widthPt = widthMM * 2.83465;
        const heightPt = heightMM * 2.83465;

        // Generate QR Code
        const qrCodeBuffer = await this.generateQRCode(
            this.getOrderDetailUrl(order.orderNumber),
            50
        );

        const doc = new PDFDocument({
            size: [widthPt, heightPt],
            margin: 8,
            info: {
                Title: `Shipping Label - ${order.orderNumber}`,
                Author: this.companyInfo.name,
            },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));

        const margin = 8;
        const contentWidth = widthPt - margin * 2;
        let yPos = margin;

        // ============================================
        // HEADER - Logo + Badge
        // ============================================

        // Logo
        const logoPath = path.join(this.assetsPath, 'logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, margin, yPos, { width: 50 });
        } else {
            doc.font('Helvetica-Bold')
                .fontSize(10)
                .fillColor('#c4a000')
                .text('KEN', margin, yPos + 2, { continued: true })
                .fillColor('#000000')
                .text(' BIKE');
        }

        // Shipping type badge (top right)
        const badgeText = order.shippingType === 'DOMESTIC' ? 'DOM' : 'INT\'L';
        const badgeColor = order.shippingType === 'DOMESTIC' ? '#16a34a' : '#2563eb';
        const badgeX = widthPt - margin - 30;

        doc.roundedRect(badgeX, yPos, 30, 14, 3)
            .fill(badgeColor);

        doc.font('Helvetica-Bold')
            .fontSize(7)
            .fillColor('#ffffff')
            .text(badgeText, badgeX, yPos + 4, { width: 30, align: 'center' });

        yPos += 20;

        // Separator line
        doc.strokeColor('#000000')
            .lineWidth(0.5)
            .moveTo(margin, yPos)
            .lineTo(widthPt - margin, yPos)
            .stroke();

        yPos += 5;

        // ============================================
        // FROM (Sender) - Compact
        // ============================================

        doc.font('Helvetica-Bold')
            .fontSize(6)
            .fillColor('#666666')
            .text('FROM:', margin, yPos);

        doc.font('Helvetica-Bold')
            .fontSize(7)
            .fillColor('#000000')
            .text(this.companyInfo.name, margin + 25, yPos);

        yPos += 9;

        doc.font('Helvetica')
            .fontSize(5)
            .fillColor('#333333')
            .text(this.companyInfo.address, margin, yPos, { width: contentWidth });

        yPos += 14;
        doc.text(this.companyInfo.phone, margin, yPos);

        yPos += 10;

        // Thick separator
        doc.strokeColor('#000000')
            .lineWidth(1.5)
            .moveTo(margin, yPos)
            .lineTo(widthPt - margin, yPos)
            .stroke();

        yPos += 6;

        // ============================================
        // TO (Recipient) - LARGE & BOLD
        // ============================================

        doc.font('Helvetica-Bold')
            .fontSize(7)
            .fillColor('#666666')
            .text('TO:', margin, yPos);

        yPos += 10;

        // Recipient name (LARGE)
        doc.font('Helvetica-Bold')
            .fontSize(12)
            .fillColor('#000000')
            .text(order.recipientName, margin, yPos, { width: contentWidth });

        yPos += 14;

        // Phone
        doc.font('Helvetica-Bold')
            .fontSize(8)
            .text(order.recipientPhone, margin, yPos);

        yPos += 10;

        // Address
        doc.font('Helvetica')
            .fontSize(7)
            .fillColor('#333333')
            .text(order.shippingAddress, margin, yPos, { width: contentWidth });

        yPos += 10;

        // City
        doc.text(`${order.shippingCity}${order.shippingProvince ? ', ' + order.shippingProvince : ''}`, margin, yPos);

        yPos += 9;

        // Country & Postal Code (BOLD)
        doc.font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('#000000')
            .text(`${order.shippingCountry} ${order.shippingPostalCode}`, margin, yPos);

        yPos += 14;

        // Separator
        doc.strokeColor('#cccccc')
            .lineWidth(0.5)
            .moveTo(margin, yPos)
            .lineTo(widthPt - margin, yPos)
            .stroke();

        yPos += 5;

        // ============================================
        // ORDER INFO + PAYMENT ICON + QR CODE
        // ============================================

        const infoY = yPos;

        // Order info (left side)
        doc.font('Helvetica')
            .fontSize(5)
            .fillColor('#666666')
            .text('ORDER:', margin, infoY);

        doc.font('Helvetica-Bold')
            .fontSize(6)
            .fillColor('#000000')
            .text(order.orderNumber, margin, infoY + 7, { width: contentWidth - 55 });

        // Tracking (if available)
        let nextLineY = infoY + 15;
        if (order.trackingNumber) {
            doc.font('Helvetica')
                .fontSize(5)
                .fillColor('#666666')
                .text('TRACKING:', margin, nextLineY);

            doc.font('Helvetica-Bold')
                .fontSize(6)
                .fillColor('#000000')
                .text(order.trackingNumber, margin, nextLineY + 7, { width: contentWidth - 55 });

            nextLineY += 15;
        }

        // Shipping method
        doc.font('Helvetica')
            .fontSize(5)
            .fillColor('#666666')
            .text('METHOD:', margin, nextLineY);

        doc.font('Helvetica')
            .fontSize(6)
            .fillColor('#000000')
            .text(order.shippingMethod || '-', margin, nextLineY + 7, { width: contentWidth - 55 });

        // Payment icon (below method)
        nextLineY += 16;
        const paymentIcon = this.getPaymentIcon(order.paymentMethod, order.paymentProvider);
        if (paymentIcon) {
            const iconPath = path.join(this.assetsPath, paymentIcon);
            if (fs.existsSync(iconPath)) {
                try {
                    doc.image(iconPath, margin, nextLineY, { height: 12 });
                } catch {
                    // Ignore if can't load image
                }
            }
        }

        // QR Code (right side)
        const qrX = widthPt - margin - 45;
        doc.image(qrCodeBuffer, qrX, infoY - 2, { width: 45 });

        // End document
        doc.end();

        return new Promise((resolve) => {
            doc.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });
    }

    /**
     * Check if result is URL type
     */
    isUrlResult(result: ShippingLabelResult): boolean {
        return result.type === 'url';
    }
}