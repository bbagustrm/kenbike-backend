# 💳 Payment Integration Documentation

**Version:** 1.0.0  
**Last Updated:** January 16, 2025

---

## **Table of Contents**
- [Overview](#overview)
- [Midtrans Snap Integration](#midtrans-snap-integration)
- [PayPal Orders v2 Integration](#paypal-orders-v2-integration)
- [Webhook Handlers](#webhook-handlers)
- [Testing Guide](#testing-guide)

---

## **Overview**

Sistem payment terintegrasi dengan 2 payment gateway:

### **1. Midtrans Snap** (Domestic - Indonesia)
- **Use Case**: Pembayaran domestik Indonesia
- **Currency**: IDR
- **Payment Methods**: 
  - Bank Transfer: BNI, BRI, Mandiri, Permata, CIMB Niaga
  - E-Wallet: GoPay
  - QRIS
  - Virtual Account

### **2. PayPal Orders v2** (International)
- **Use Case**: Pembayaran internasional
- **Currency**: USD
- **Payment Methods**: PayPal Wallet, Credit/Debit Cards

---

# **Midtrans Snap Integration**

## **Architecture**

```
Create Order (Backend)
       ↓
Call Midtrans Snap API
       ├─ Send transaction details
       ├─ Get Snap Token
       └─ Get Redirect URL
       ↓
Return Snap URL to Frontend
       ↓
User redirected to Midtrans Snap Page
       ├─ Select payment method
       ├─ Complete payment
       └─ Redirected back to merchant
       ↓
Midtrans sends Webhook to Backend
       ├─ Verify signature
       ├─ Update payment status
       ├─ Update order status
       └─ Send confirmation email
```

---

## **1. Installation**

```bash
npm install midtrans-client
```

---

## **2. Configuration**

**Environment Variables:**
```env
# Midtrans Configuration
MIDTRANS_SERVER_KEY=SB-Mid-server-KbFvBzQ59S8IkZy30Xe4cWPk
MIDTRANS_CLIENT_KEY=SB-Mid-client-ls17HF7HwIV7b_je
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_MERCHANT_ID=G958339263

# Webhook URLs
MIDTRANS_WEBHOOK_URL=https://api.kenbike.store/api/v1/webhooks/midtrans
# For local dev with ngrok:
# MIDTRANS_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/v1/webhooks/midtrans

# Frontend URLs
FRONTEND_SUCCESS_URL=https://kenbike.store/orders/success
FRONTEND_PENDING_URL=https://kenbike.store/orders/pending
FRONTEND_ERROR_URL=https://kenbike.store/orders/failed
```

**Production Changes:**
```env
# Production
MIDTRANS_SERVER_KEY=Mid-server-PRODUCTION_KEY
MIDTRANS_CLIENT_KEY=Mid-client-PRODUCTION_KEY
MIDTRANS_IS_PRODUCTION=true
MIDTRANS_WEBHOOK_URL=https://api.kenbike.store/api/v1/webhooks/midtrans
```

---

## **3. Create Midtrans Transaction**

**File: `src/payment/midtrans.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as midtransClient from 'midtrans-client');
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MidtransService {
  private snap: any;
  private readonly logger = new Logger(MidtransService.name);

  constructor(private configService: ConfigService) {
    this.snap = new midtransClient.Snap({
      isProduction: this.configService.get('MIDTRANS_IS_PRODUCTION') === 'true',
      serverKey: this.configService.get('MIDTRANS_SERVER_KEY'),
      clientKey: this.configService.get('MIDTRANS_CLIENT_KEY'),
    });
  }

  async createTransaction(order: any, user: any) {
    try {
      // Prepare item details
      const itemDetails = order.items.map((item) => ({
        id: item.variantId,
        price: item.pricePerItem,
        quantity: item.quantity,
        name: `${item.productName} - ${item.variantName}`,
      }));

      // Add shipping as item
      if (order.shippingCost > 0) {
        itemDetails.push({
          id: 'SHIPPING',
          price: order.shippingCost,
          quantity: 1,
          name: `Shipping - ${order.biteshipCourier} ${order.biteshipService}`,
        });
      }

      // Add tax as item
      if (order.tax > 0) {
        itemDetails.push({
          id: 'TAX',
          price: order.tax,
          quantity: 1,
          name: 'PPN 11%',
        });
      }

      const parameter = {
        transaction_details: {
          order_id: order.orderNumber,
          gross_amount: order.total,
        },
        credit_card: {
          secure: true, // Enable 3D Secure
        },
        customer_details: {
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
          phone: user.phoneNumber || order.recipientPhone,
          billing_address: {
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email,
            phone: user.phoneNumber || order.recipientPhone,
            address: order.shippingAddress,
            city: order.shippingCity,
            postal_code: order.shippingPostalCode,
            country_code: 'IDN',
          },
          shipping_address: {
            first_name: order.recipientName.split(' ')[0],
            last_name: order.recipientName.split(' ').slice(1).join(' '),
            phone: order.recipientPhone,
            address: order.shippingAddress,
            city: order.shippingCity,
            postal_code: order.shippingPostalCode,
            country_code: 'IDN',
          },
        },
        item_details: itemDetails,
        callbacks: {
          finish: this.configService.get('FRONTEND_SUCCESS_URL'),
          error: this.configService.get('FRONTEND_ERROR_URL'),
          pending: this.configService.get('FRONTEND_PENDING_URL'),
        },
        enabled_payments: [
          'credit_card',
          'bca_va',
          'bni_va',
          'bri_va',
          'permata_va',
          'cimb_va',
          'gopay',
          'qris',
        ],
        expiry: {
          start_time: new Date().toISOString(),
          unit: 'hours',
          duration: 24,
        },
      };

      this.logger.log(`Creating Midtrans transaction for order: ${order.orderNumber}`);
      
      const transaction = await this.snap.createTransaction(parameter);

      return {
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
      };
    } catch (error) {
      this.logger.error('Failed to create Midtrans transaction', error);
      throw error;
    }
  }

  async getTransactionStatus(orderId: string) {
    try {
      const statusResponse = await this.snap.transaction.status(orderId);
      return statusResponse;
    } catch (error) {
      this.logger.error(`Failed to get transaction status for ${orderId}`, error);
      throw error;
    }
  }
}
```

---

## **4. Midtrans Webhook Handler**

**File: `src/webhooks/midtrans-webhook.controller.ts`**

```typescript
import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MidtransWebhookService } from './midtrans-webhook.service';
import { Public } from '@/common/decorators/public.decorator';

@Controller('webhooks/midtrans')
export class MidtransWebhookController {
  private readonly logger = new Logger(MidtransWebhookController.name);

  constructor(
    private readonly midtransWebhookService: MidtransWebhookService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() notification: any) {
    this.logger.log('Received Midtrans webhook notification');
    this.logger.debug('Notification data:', notification);

    try {
      await this.midtransWebhookService.handleNotification(notification);
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Failed to process Midtrans webhook', error);
      throw error;
    }
  }
}
```

**File: `src/webhooks/midtrans-webhook.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MailService } from '@/mail/mail.service';

@Injectable()
export class MidtransWebhookService {
  private readonly logger = new Logger(MidtransWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async handleNotification(notification: any) {
    // Verify signature
    const isValid = this.verifySignature(notification);
    if (!isValid) {
      this.logger.error('Invalid signature from Midtrans webhook');
      throw new Error('Invalid signature');
    }

    const { order_id, transaction_status, fraud_status, transaction_id } = notification;

    this.logger.log(`Processing order: ${order_id}, status: ${transaction_status}`);

    // Find order
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: order_id },
      include: { payment: true, user: true, items: true },
    });

    if (!order) {
      this.logger.error(`Order not found: ${order_id}`);
      return;
    }

    // Update payment record
    await this.prisma.payment.update({
      where: { orderId: order.id },
      data: {
        midtransTransactionId: transaction_id,
        paymentResponse: notification,
        updatedAt: new Date(),
      },
    });

    // Handle different transaction statuses
    if (transaction_status === 'capture') {
      if (fraud_status === 'accept') {
        await this.markAsPaid(order);
      }
    } else if (transaction_status === 'settlement') {
      await this.markAsPaid(order);
    } else if (transaction_status === 'pending') {
      await this.markAsPending(order);
    } else if (
      transaction_status === 'deny' ||
      transaction_status === 'expire' ||
      transaction_status === 'cancel'
    ) {
      await this.markAsFailed(order);
    }
  }

  private verifySignature(notification: any): boolean {
    const { order_id, status_code, gross_amount, signature_key } = notification;
    const serverKey = this.configService.get('MIDTRANS_SERVER_KEY');

    const hash = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');

    return hash === signature_key;
  }

  private async markAsPaid(order: any) {
    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { orderId: order.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      // Update order status
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    });

    // Send confirmation email
    await this.mailService.sendPaymentConfirmation(order.user, order);

    this.logger.log(`Order ${order.orderNumber} marked as PAID`);
  }

  private async markAsPending(order: any) {
    await this.prisma.payment.update({
      where: { orderId: order.id },
      data: { status: 'PENDING' },
    });
  }

  private async markAsFailed(order: any) {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { orderId: order.id },
        data: { status: 'FAILED' },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      });

      // Release stock
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stock: { increment: item.quantity },
          },
        });
      }
    });

    this.logger.log(`Order ${order.orderNumber} marked as FAILED`);
  }
}
```

---

# **PayPal Orders v2 Integration**

## **Architecture**

```
Create Order (Backend)
       ↓
Call PayPal Create Order API
       ├─ Send order details (USD)
       ├─ Get Order ID
       └─ Get Approval URL
       ↓
Return Approval URL to Frontend
       ↓
User redirected to PayPal
       ├─ Login to PayPal
       ├─ Approve payment
       └─ Redirected back to merchant
       ↓
Frontend calls Capture Payment (Backend)
       ↓
Call PayPal Capture Order API
       ├─ Capture payment
       ├─ Get Capture ID
       └─ Update order status
       ↓
Send confirmation email
```

---

## **1. Installation**

```bash
npm install @paypal/checkout-server-sdk
```

---

## **2. Configuration**

**Environment Variables:**
```env
# PayPal Configuration
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=Af-kUs2_aEO7E3t6JSzFkrcaYjhzg8WomartVV6_FdPuTEskEW6QaS8hUOuSsaqeHSKo27Zm04ZCDQnx
PAYPAL_CLIENT_SECRET=EIlEtQj9HqO5hLuISeO-ixQJNKsrsKFuhc8HBqJ3bFOHQCizy-uzs2O6TzZ67gxMYZDo88Vh1BHp5xBM

# Currency Exchange Rate (update regularly or use API)
USD_TO_IDR_RATE=15700

# Frontend URLs
PAYPAL_RETURN_URL=https://kenbike.store/orders/paypal-success
PAYPAL_CANCEL_URL=https://kenbike.store/orders/paypal-cancel
```

**Production Changes:**
```env
# Production
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=YOUR_PRODUCTION_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_PRODUCTION_SECRET
```

---

## **3. Create PayPal Order**

**File: `src/payment/paypal.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as paypal from '@paypal/checkout-server-sdk';

@Injectable()
export class PayPalService {
  private client: any;
  private readonly logger = new Logger(PayPalService.name);

  constructor(private configService: ConfigService) {
    const environment =
      this.configService.get('PAYPAL_MODE') === 'live'
        ? new paypal.core.LiveEnvironment(
            this.configService.get('PAYPAL_CLIENT_ID'),
            this.configService.get('PAYPAL_CLIENT_SECRET'),
          )
        : new paypal.core.SandboxEnvironment(
            this.configService.get('PAYPAL_CLIENT_ID'),
            this.configService.get('PAYPAL_CLIENT_SECRET'),
          );

    this.client = new paypal.core.PayPalHttpClient(environment);
  }

  async createOrder(order: any, user: any) {
    try {
      // Convert IDR to USD
      const exchangeRate = parseFloat(
        this.configService.get('USD_TO_IDR_RATE') || '15700',
      );
      const amountUSD = (order.total / exchangeRate).toFixed(2);

      // Prepare items
      const items = order.items.map((item) => ({
        name: `${item.productName} - ${item.variantName}`,
        unit_amount: {
          currency_code: 'USD',
          value: (item.pricePerItem / exchangeRate).toFixed(2),
        },
        quantity: item.quantity.toString(),
        sku: item.sku,
      }));

      // Add shipping
      const shippingUSD = (order.shippingCost / exchangeRate).toFixed(2);
      const taxUSD = (order.tax / exchangeRate).toFixed(2);
      const itemTotalUSD = (order.subtotal / exchangeRate).toFixed(2);

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: order.orderNumber,
            amount: {
              currency_code: 'USD',
              value: amountUSD,
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: itemTotalUSD,
                },
                shipping: {
                  currency_code: 'USD',
                  value: shippingUSD,
                },
                tax_total: {
                  currency_code: 'USD',
                  value: taxUSD,
                },
              },
            },
            items: items,
            shipping: {
              name: {
                full_name: order.recipientName,
              },
              address: {
                address_line_1: order.shippingAddress,
                admin_area_2: order.shippingCity,
                postal_code: order.shippingPostalCode,
                country_code: this.getCountryCode(order.shippingCountry),
              },
            },
          },
        ],
        application_context: {
          brand_name: 'Kenbike Store',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: this.configService.get('PAYPAL_RETURN_URL'),
          cancel_url: this.configService.get('PAYPAL_CANCEL_URL'),
        },
      });

      this.logger.log(`Creating PayPal order for: ${order.orderNumber}`);

      const response = await this.client.execute(request);
      const paypalOrder = response.result;

      // Get approval URL
      const approvalUrl = paypalOrder.links.find(
        (link) => link.rel === 'approve',
      )?.href;

      return {
        orderId: paypalOrder.id,
        approvalUrl: approvalUrl,
        status: paypalOrder.status,
      };
    } catch (error) {
      this.logger.error('Failed to create PayPal order', error);
      throw error;
    }
  }

  async captureOrder(paypalOrderId: string) {
    try {
      const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
      request.requestBody({});

      this.logger.log(`Capturing PayPal order: ${paypalOrderId}`);

      const response = await this.client.execute(request);
      const captureData = response.result;

      return {
        captureId: captureData.purchase_units[0].payments.captures[0].id,
        status: captureData.status,
        payer: captureData.payer,
      };
    } catch (error) {
      this.logger.error(`Failed to capture PayPal order: ${paypalOrderId}`, error);
      throw error;
    }
  }

  async getOrderDetails(paypalOrderId: string) {
    try {
      const request = new paypal.orders.OrdersGetRequest(paypalOrderId);
      const response = await this.client.execute(request);
      return response.result;
    } catch (error) {
      this.logger.error(`Failed to get PayPal order details: ${paypalOrderId}`, error);
      throw error;
    }
  }

  private getCountryCode(country: string): string {
    // Map country names to ISO codes
    const countryMap = {
      'Indonesia': 'ID',
      'United States': 'US',
      'Singapore': 'SG',
      'Malaysia': 'MY',
      // Add more as needed
    };
    return countryMap[country] || 'US';
  }
}
```

---

## **4. Capture Payment Endpoint**

**File: `src/payment/payment.controller.ts`**

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PayPalService } from './paypal.service';
import { PrismaService } from '@/common/prisma.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    private paypalService: PayPalService,
    private prisma: PrismaService,
  ) {}

  @Post('paypal/capture')
  async capturePayPalPayment(
    @Body('paypalOrderId') paypalOrderId: string,
    @CurrentUser() user: any,
  ) {
    // Get payment record
    const payment = await this.prisma.payment.findUnique({
      where: { paypalOrderId },
      include: { order: true },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Verify user owns this order
    if (payment.order.userId !== user.id) {
      throw new Error('Unauthorized');
    }

    // Capture payment
    const captureResult = await this.paypalService.captureOrder(paypalOrderId);

    // Update payment and order status
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paypalCaptureId: captureResult.captureId,
          paidAt: new Date(),
          paymentResponse: captureResult,
        },
      }),
      this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      }),
    ]);

    return {
      status: 'success',
      message: 'Payment captured successfully',
      data: {
        orderId: payment.order.id,
        orderNumber: payment.order.orderNumber,
        captureId: captureResult.captureId,
      },
    };
  }
}
```

---

## **Testing Guide**

### **Midtrans Testing**

**Test Credit Cards:**
```
Card Number: 4811 1111 1111 1114
CVV: 123
Expiry: Any future date
OTP/3DS: 112233
```

**Test Virtual Accounts:**
- BCA VA: Use any amount, auto-approve in sandbox
- BNI VA: Use any amount, auto-approve in sandbox

### **PayPal Testing**

**Sandbox Accounts:**
- Personal (Buyer): Use sandbox account from PayPal Developer Dashboard
- Business (Seller): Your merchant account

**Test Flow:**
1. Create order → Get approval URL
2. Open approval URL in browser
3. Login with sandbox personal account
4. Approve payment
5. Call capture endpoint

---

## **Production Checklist**

- [ ] Change `MIDTRANS_IS_PRODUCTION=true`
- [ ] Change `PAYPAL_MODE=live`
- [ ] Update to production API keys
- [ ] Configure production webhook URLs in dashboards
- [ ] Set up SSL certificates
- [ ] Test webhook handlers with production
- [ ] Monitor payment failures
- [ ] Set up payment reconciliation cron
- [ ] Configure email notifications
- [ ] Set up error alerting

---

## **Webhook URL Configuration**

### **Midtrans Dashboard:**
1. Login to https://dashboard.midtrans.com
2. Go to Settings → Configuration
3. Set Payment Notification URL: `https://api.kenbike.store/api/v1/webhooks/midtrans`

### **PayPal Dashboard:**
1. Login to https://developer.paypal.com
2. Go to Apps & Credentials
3. Select your app
4. Add webhook: `https://api.kenbike.store/api/v1/webhooks/paypal`
5. Subscribe to events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`

