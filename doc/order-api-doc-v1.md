# 📦 Order Management API Documentation

**Version:** 1.0.0  
**Last Updated:** January 16, 2025  
**Base URL:** `http://localhost:3000/api/v1`

---

## **Table of Contents**
- [Overview](#overview)
- [Order Flow](#order-flow)
- [Order Status Transitions](#order-status-transitions)
- [Public Endpoints](#public-endpoints)
- [Admin Endpoints](#admin-endpoints)

---

## **Overview**

Order management system yang terintegrasi dengan:
- **Payment Gateways**: Midtrans Snap (domestic), PayPal (international)
- **Shipping**: Biteship (domestic), Manual zone-based (international)
- **Stock Management**: Auto-hold on order creation, auto-release after 24h if unpaid

**Order Statuses:**
- `PENDING` → Order created, waiting for payment
- `PAID` → Payment received successfully
- `PROCESSING` → Admin is processing order
- `SHIPPED` → Order shipped with tracking number
- `DELIVERED` → Order delivered to customer
- `COMPLETED` → Order completed (after review period)
- `CANCELED` → Order canceled
- `FAILED` → Payment failed

---

## **Order Flow**

```
User adds items to cart
       ↓
User proceeds to checkout
       ↓
Select shipping address & method
       ↓
Calculate shipping cost (Biteship API / Manual)
       ↓
Create Order (status: PENDING)
       ├─ Stock di-hold
       ├─ Create Payment (Midtrans/PayPal)
       └─ Generate payment URL
       ↓
User redirected to payment gateway
       ↓
User completes payment
       ↓
Webhook received → Update Order (status: PAID)
       ├─ Stock confirmed
       └─ Send email confirmation
       ↓
Admin processes order (status: PROCESSING)
       ↓
Admin ships order (status: SHIPPED)
       ├─ Input tracking number
       └─ Send shipping notification email
       ↓
Order delivered (status: DELIVERED)
       ├─ User can review product
       └─ After 14 days → COMPLETED
```

---

## **Order Status Transitions**

| From Status | To Status | Triggered By | Action |
|-------------|-----------|--------------|--------|
| PENDING | PAID | Webhook from payment gateway | Confirm stock hold, send confirmation email |
| PENDING | FAILED | Webhook / Timeout | Release stock, notify user |
| PENDING | CANCELED | User / Admin | Release stock, refund if paid |
| PAID | PROCESSING | Admin | Mark as being processed |
| PROCESSING | SHIPPED | Admin | Input tracking number, send shipping email |
| SHIPPED | DELIVERED | Admin / Tracking update | Enable review, send delivery email |
| DELIVERED | COMPLETED | Auto after 14 days | Close order |

---

# **Public Endpoints (User)**

## 1. Calculate Shipping Cost

> **POST** `/orders/calculate-shipping`

**Description:**  
Calculate shipping cost sebelum create order. Support domestic (Biteship) dan international (manual zone-based).

**Authorization:** Required (USER)

**Request Body - Domestic (Indonesia):**
```json
{
  "items": [
    {
      "productId": "product-uuid-1",
      "variantId": "variant-uuid-1",
      "quantity": 2
    }
  ],
  "destination": {
    "country": "Indonesia",
    "postalCode": "12440",
    "city": "Jakarta Selatan",
    "address": "Jl. Sudirman No. 1"
  }
}
```

**Request Body - International:**
```json
{
  "items": [
    {
      "productId": "product-uuid-1",
      "variantId": "variant-uuid-1",
      "quantity": 2
    }
  ],
  "destination": {
    "country": "United States",
    "postalCode": "10001",
    "city": "New York",
    "address": "123 Main St"
  }
}
```

**Response (200 OK) - Domestic:**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "shippingMethod": "BITESHIP",
    "totalWeight": 3200,
    "couriers": [
      {
        "courier": "jne",
        "courierName": "JNE",
        "services": [
          {
            "service": "reg",
            "serviceName": "Reguler",
            "price": 15000,
            "estimatedDays": "2-3 days"
          },
          {
            "service": "oke",
            "serviceName": "OKE",
            "price": 12000,
            "estimatedDays": "3-5 days"
          }
        ]
      },
      {
        "courier": "tiki",
        "courierName": "TIKI",
        "services": [
          {
            "service": "reg",
            "serviceName": "Regular Service",
            "price": 14000,
            "estimatedDays": "3-4 days"
          }
        ]
      },
      {
        "courier": "sicepat",
        "courierName": "SiCepat",
        "services": [
          {
            "service": "reg",
            "serviceName": "Reguler",
            "price": 13000,
            "estimatedDays": "2-3 days"
          }
        ]
      }
    ]
  }
}
```

**Response (200 OK) - International:**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "shippingMethod": "MANUAL_INTERNATIONAL",
    "totalWeight": 3200,
    "zone": {
      "id": "zone-uuid-1",
      "name": "Americas",
      "baseRate": 150000,
      "perKgRate": 50000,
      "minDays": 14,
      "maxDays": 21
    },
    "shippingCost": 300000,
    "estimatedDelivery": "14-21 days",
    "calculation": {
      "baseRate": 150000,
      "additionalWeight": 3,
      "additionalCost": 150000,
      "total": 300000
    }
  }
}
```

---

## 2. Create Order

> **POST** `/orders`

**Description:**  
Create order dari cart items. Generate payment URL (Midtrans Snap atau PayPal).

**Authorization:** Required (USER)

**Request Body - Domestic Order:**
```json
{
  "shippingAddress": {
    "recipientName": "John Doe",
    "recipientPhone": "+628123456789",
    "address": "Jl. Sudirman No. 1, Karet Tengsin",
    "city": "Jakarta Selatan",
    "province": "DKI Jakarta",
    "country": "Indonesia",
    "postalCode": "12440",
    "notes": "Depan gedung A"
  },
  "shipping": {
    "method": "BITESHIP",
    "courier": "jne",
    "service": "reg"
  },
  "paymentMethod": "MIDTRANS"
}
```

**Request Body - International Order:**
```json
{
  "shippingAddress": {
    "recipientName": "John Smith",
    "recipientPhone": "+1234567890",
    "address": "123 Main Street",
    "city": "New York",
    "country": "United States",
    "postalCode": "10001",
    "notes": "Leave at reception"
  },
  "shipping": {
    "method": "MANUAL_INTERNATIONAL",
    "zoneId": "zone-uuid-1"
  },
  "paymentMethod": "PAYPAL"
}
```

**Response (201 Created) - Midtrans:**
```json
{
  "status": "success",
  "code": 201,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "order-uuid-1",
      "orderNumber": "ORD-20250116-0001",
      "userId": "user-uuid-1",
      "status": "PENDING",
      "subtotal": 50000000,
      "discount": 0,
      "tax": 5500000,
      "shippingCost": 15000,
      "total": 55515000,
      "currency": "IDR",
      "shippingMethod": "BITESHIP",
      "biteshipCourier": "jne",
      "biteshipService": "reg",
      "shippingAddress": {
        "recipientName": "John Doe",
        "recipientPhone": "+628123456789",
        "address": "Jl. Sudirman No. 1, Karet Tengsin",
        "city": "Jakarta Selatan",
        "province": "DKI Jakarta",
        "country": "Indonesia",
        "postalCode": "12440"
      },
      "items": [
        {
          "id": "order-item-uuid-1",
          "productName": "MacBook Pro M3",
          "variantName": "Space Gray 512GB",
          "sku": "MBP-M3-SG-512",
          "quantity": 2,
          "pricePerItem": 25000000,
          "subtotal": 50000000
        }
      ],
      "createdAt": "2025-01-16T12:00:00.000Z"
    },
    "payment": {
      "id": "payment-uuid-1",
      "paymentMethod": "MIDTRANS",
      "status": "PENDING",
      "amount": 55515000,
      "currency": "IDR",
      "midtransToken": "66e4fa55-fdac-4ef9-91b5-733b97d1b862",
      "midtransRedirectUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/66e4fa55-fdac-4ef9-91b5-733b97d1b862",
      "expiredAt": "2025-01-17T12:00:00.000Z"
    }
  }
}
```

**Response (201 Created) - PayPal:**
```json
{
  "status": "success",
  "code": 201,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "order-uuid-2",
      "orderNumber": "ORD-20250116-0002",
      "userId": "user-uuid-1",
      "status": "PENDING",
      "subtotal": 50000000,
      "discount": 0,
      "tax": 5500000,
      "shippingCost": 300000,
      "total": 55800000,
      "currency": "USD",
      "exchangeRate": 15700,
      "shippingMethod": "MANUAL_INTERNATIONAL",
      "shippingZoneId": "zone-uuid-1",
      "shippingAddress": {
        "recipientName": "John Smith",
        "recipientPhone": "+1234567890",
        "address": "123 Main Street",
        "city": "New York",
        "country": "United States",
        "postalCode": "10001"
      },
      "items": [
        {
          "id": "order-item-uuid-2",
          "productName": "MacBook Pro M3",
          "variantName": "Space Gray 512GB",
          "sku": "MBP-M3-SG-512",
          "quantity": 2,
          "pricePerItem": 25000000,
          "subtotal": 50000000
        }
      ],
      "createdAt": "2025-01-16T12:05:00.000Z"
    },
    "payment": {
      "id": "payment-uuid-2",
      "paymentMethod": "PAYPAL",
      "status": "PENDING",
      "amount": 3553,
      "currency": "USD",
      "paypalOrderId": "8Y123456789012345",
      "paypalApprovalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=8Y123456789012345",
      "expiredAt": "2025-01-17T12:05:00.000Z"
    }
  }
}
```

**Error (400 Bad Request) - Empty Cart:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Cart is empty"
}
```

**Error (400 Bad Request) - Insufficient Stock:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Insufficient stock for some items",
  "errors": [
    {
      "field": "items",
      "message": "MacBook Pro M3 - Space Gray 512GB: requested 5, available 3"
    }
  ]
}
```

---

## 3. Get User Orders

> **GET** `/orders`

**Description:**  
Get all orders for current user with pagination.

**Authorization:** Required (USER)

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 10)
- `status` (string, optional) - Filter by status
- `sortBy` (string, default: createdAt) - Sort by field
- `order` (string, default: desc) - Sort order

**Example Request:**
```
GET /orders?page=1&limit=10&status=PAID&sortBy=createdAt&order=desc
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [
    {
      "id": "order-uuid-1",
      "orderNumber": "ORD-20250116-0001",
      "status": "PAID",
      "total": 55515000,
      "currency": "IDR",
      "items": [
        {
          "productName": "MacBook Pro M3",
          "variantName": "Space Gray 512GB",
          "quantity": 2,
          "pricePerItem": 25000000
        }
      ],
      "shippingAddress": {
        "recipientName": "John Doe",
        "city": "Jakarta Selatan",
        "country": "Indonesia"
      },
      "payment": {
        "paymentMethod": "MIDTRANS",
        "status": "PAID",
        "paidAt": "2025-01-16T12:15:00.000Z"
      },
      "createdAt": "2025-01-16T12:00:00.000Z",
      "paidAt": "2025-01-16T12:15:00.000Z"
    }
  ]
}
```

---

## 4. Get Order Detail

> **GET** `/orders/:orderNumber`

**Description:**  
Get detail order by order number.

**Authorization:** Required (USER, can only view own orders)

**Path Parameters:**
- `orderNumber`: Order number (e.g., ORD-20250116-0001)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "order-uuid-1",
    "orderNumber": "ORD-20250116-0001",
    "userId": "user-uuid-1",
    "status": "SHIPPED",
    "subtotal": 50000000,
    "discount": 0,
    "tax": 5500000,
    "shippingCost": 15000,
    "total": 55515000,
    "currency": "IDR",
    "shippingMethod": "BITESHIP",
    "biteshipCourier": "jne",
    "biteshipService": "reg",
    "biteshipOrderId": "biteship-123456",
    "trackingNumber": "JNE1234567890",
    "shippingAddress": {
      "recipientName": "John Doe",
      "recipientPhone": "+628123456789",
      "address": "Jl. Sudirman No. 1, Karet Tengsin",
      "city": "Jakarta Selatan",
      "province": "DKI Jakarta",
      "country": "Indonesia",
      "postalCode": "12440",
      "notes": "Depan gedung A"
    },
    "items": [
      {
        "id": "order-item-uuid-1",
        "productId": "product-uuid-1",
        "variantId": "variant-uuid-1",
        "productName": "MacBook Pro M3",
        "variantName": "Space Gray 512GB",
        "sku": "MBP-M3-SG-512",
        "quantity": 2,
        "pricePerItem": 25000000,
        "discount": 0,
        "subtotal": 50000000,
        "productImage": "https://cdn.store.com/products/macbook.jpg"
      }
    ],
    "payment": {
      "id": "payment-uuid-1",
      "paymentMethod": "MIDTRANS",
      "status": "PAID",
      "amount": 55515000,
      "currency": "IDR",
      "midtransTransactionId": "mid-123456",
      "paidAt": "2025-01-16T12:15:00.000Z"
    },
    "timeline": [
      {
        "status": "PENDING",
        "timestamp": "2025-01-16T12:00:00.000Z",
        "description": "Order created"
      },
      {
        "status": "PAID",
        "timestamp": "2025-01-16T12:15:00.000Z",
        "description": "Payment received"
      },
      {
        "status": "PROCESSING",
        "timestamp": "2025-01-16T14:00:00.000Z",
        "description": "Order is being processed"
      },
      {
        "status": "SHIPPED",
        "timestamp": "2025-01-17T10:00:00.000Z",
        "description": "Order shipped with JNE (JNE1234567890)"
      }
    ],
    "canReview": false,
    "canCancel": false,
    "createdAt": "2025-01-16T12:00:00.000Z",
    "paidAt": "2025-01-16T12:15:00.000Z",
    "shippedAt": "2025-01-17T10:00:00.000Z"
  }
}
```

**Error (404 Not Found):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Order not found"
}
```

---

## 5. Cancel Order

> **POST** `/orders/:orderNumber/cancel`

**Description:**  
Cancel order. Only allowed if status is PENDING or PAID (before PROCESSING).

**Authorization:** Required (USER, can only cancel own orders)

**Path Parameters:**
- `orderNumber`: Order number

**Request Body:**
```json
{
  "reason": "Changed my mind"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Order canceled successfully",
  "data": {
    "orderId": "order-uuid-1",
    "orderNumber": "ORD-20250116-0001",
    "status": "CANCELED",
    "refundInfo": {
      "amount": 55515000,
      "currency": "IDR",
      "expectedIn": "3-7 business days"
    },
    "canceledAt": "2025-01-16T13:00:00.000Z"
  }
}
```

**Error (400 Bad Request) - Cannot Cancel:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Order cannot be canceled",
  "errors": [
    {
      "field": "status",
      "message": "Orders with status SHIPPED cannot be canceled"
    }
  ]
}
```

---

## 6. Track Order Shipment

> **GET** `/orders/:orderNumber/tracking`

**Description:**  
Get shipment tracking information (for Biteship domestic orders).

**Authorization:** Required (USER)

**Path Parameters:**
- `orderNumber`: Order number

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "orderNumber": "ORD-20250116-0001",
    "trackingNumber": "JNE1234567890",
    "courier": "jne",
    "courierName": "JNE",
    "service": "reg",
    "status": "delivered",
    "history": [
      {
        "timestamp": "2025-01-17T10:00:00.000Z",
        "status": "picked_up",
        "description": "Paket telah diambil kurir"
      },
      {
        "timestamp": "2025-01-17T14:00:00.000Z",
        "status": "in_transit",
        "description": "Paket dalam pengiriman"
      },
      {
        "timestamp": "2025-01-18T09:00:00.000Z",
        "status": "delivered",
        "description": "Paket telah diterima oleh John Doe"
      }
    ],
    "estimatedDelivery": "2025-01-18",
    "lastUpdate": "2025-01-18T09:00:00.000Z"
  }
}
```

**Error (404 Not Found) - No Tracking:**
```json
{
  "status": "error",
  "code": 404,
  "message": "Tracking information not available yet"
}
```

---

# **Admin Endpoints**

## 7. Get All Orders (Admin)

> **GET** `/admin/orders`

**Description:**  
Get all orders with advanced filtering for admin.

**Authorization:** Required (ADMIN, OWNER)

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `status` (string, optional)
- `paymentStatus` (string, optional)
- `paymentMethod` (string, optional)
- `search` (string, optional) - Search by order number, customer name
- `dateFrom` (date, optional) - Filter from date
- `dateTo` (date, optional) - Filter to date
- `sortBy` (string, default: createdAt)
- `order` (string, default: desc)

**Example Request:**
```
GET /admin/orders?status=PAID&page=1&limit=20&sortBy=createdAt&order=desc
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [
    {
      "id": "order-uuid-1",
      "orderNumber": "ORD-20250116-0001",
      "customer": {
        "id": "user-uuid-1",
        "name": "John Doe",
        "email": "[email protected]",
        "phone": "+628123456789"
      },
      "status": "PAID",
      "total": 55515000,
      "currency": "IDR",
      "itemsCount": 1,
      "payment": {
        "method": "MIDTRANS",
        "status": "PAID",
        "paidAt": "2025-01-16T12:15:00.000Z"
      },
      "shipping": {
        "method": "BITESHIP",
        "courier": "jne",
        "city": "Jakarta Selatan",
        "country": "Indonesia"
      },
      "createdAt": "2025-01-16T12:00:00.000Z",
      "paidAt": "2025-01-16T12:15:00.000Z"
    }
  ]
}
```

---

## 8. Get Order Detail (Admin)

> **GET** `/admin/orders/:id`

**Description:**  
Get complete order details including payment response.

**Authorization:** Required (ADMIN, OWNER)

**Response:** Same as user Get Order Detail, but includes additional fields:
- Full payment gateway response
- Admin notes
- Action history

---

## 9. Update Order Status

> **PATCH** `/admin/orders/:id/status`

**Description:**  
Update order status. Different actions for different status transitions.

**Authorization:** Required (ADMIN, OWNER)

**Request Body - Mark as Processing:**
```json
{
  "status": "PROCESSING",
  "notes": "Order is being prepared"
}
```

**Request Body - Mark as Shipped (Biteship):**
```json
{
  "status": "SHIPPED",
  "trackingNumber": "JNE1234567890",
  "notes": "Shipped via JNE Reguler"
}
```

**Request Body - Mark as Delivered:**
```json
{
  "status": "DELIVERED",
  "notes": "Delivered successfully"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Order status updated successfully",
  "data": {
    "orderId": "order-uuid-1",
    "orderNumber": "ORD-20250116-0001",
    "previousStatus": "PAID",
    "currentStatus": "PROCESSING",
    "updatedAt": "2025-01-16T14:00:00.000Z",
    "emailSent": true
  }
}
```

---

## 10. Create Biteship Shipment

> **POST** `/admin/orders/:id/create-shipment`

**Description:**  
Create shipment di Biteship dan dapatkan AWB (Airway Bill) number.

**Authorization:** Required (ADMIN, OWNER)

**Request Body:**
```json
{
  "courierInsurance": 500000
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Shipment created successfully",
  "data": {
    "biteshipOrderId": "biteship-order-123456",
    "trackingNumber": "JNE1234567890",
    "courier": "jne",
    "service": "reg",
    "shippingCost": 15000,
    "insurance": 500000,
    "estimatedDelivery": "2-3 days",
    "pickupSchedule": {
      "date": "2025-01-17",
      "timeSlot": "14:00-18:00"
    }
  }
}
```

---

## **Auto-Release Stock System**

### **Background Job (CRON)**
```javascript
// Run every hour
async function releaseExpiredOrders() {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      createdAt: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      }
    }
  });
  
  for (const order of expiredOrders) {
    // Release stock
    await releaseOrderStock(order);
    
    // Update status
    await prisma.order.update({
      where: { id: order.id },
      data: { 
        status: 'CANCELED',
        canceledAt: new Date()
      }
    });
    
    // Send notification
    await sendOrderCanceledEmail(order.userId, order.orderNumber);
  }
}
```

---

## **Email Notifications**

### **Email Types:**
1. **Order Confirmation** (after order created)
2. **Payment Received** (after payment success)
3. **Order Processing** (when admin marks as processing)
4. **Shipment Notification** (when order shipped)
5. **Delivery Confirmation** (when order delivered)
6. **Review Reminder** (3 days after delivery)
7. **Order Canceled** (when order canceled)

---

## **Error Handling**

### **Common Errors:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Cannot create order",
  "errors": [
    {
      "field": "cart",
      "message": "Cart is empty"
    }
  ]
}
```

```json
{
  "status": "error",
  "code": 400,
  "message": "Payment gateway error",
  "errors": [
    {
      "field": "payment",
      "message": "Failed to create Midtrans transaction"
    }
  ]
}
```

---

## **Database Schema Reference**

```prisma
model Order {
  id              String      @id @default(uuid())
  orderNumber     String      @unique
  userId          String
  status          OrderStatus
  subtotal        Int
  tax             Int
  shippingCost    Int
  total           Int
  currency        String
  shippingMethod  ShippingMethod
  // ... other fields
}
```
