# 🛒 Cart Management API Documentation

**Version:** 1.0.0  
**Last Updated:** January 16, 2025  
**Base URL:** `http://localhost:3000/api/v1`

---

## **Overview**

Cart management system untuk menyimpan item yang akan dibeli user. Cart bersifat persistent (tersimpan di database) sehingga user bisa logout dan kembali lagi dengan cart yang sama.

**Key Features:**
- One cart per user
- Automatic quantity update jika item sudah ada di cart
- Real-time stock validation
- Auto-calculate subtotal

---

## **Authentication**

All cart endpoints require user authentication:
```
Authorization: Bearer <access_token>
```

---

# **Cart Endpoints**

## 1. Get User Cart

> **GET** `/cart`

**Description:**  
Mengambil cart user yang sedang login beserta semua items.

**Authorization:** Required (USER)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "cart-uuid-1",
    "userId": "user-uuid-1",
    "items": [
      {
        "id": "cart-item-uuid-1",
        "productId": "product-uuid-1",
        "variantId": "variant-uuid-1",
        "quantity": 2,
        "product": {
          "id": "product-uuid-1",
          "name": "MacBook Pro M3",
          "slug": "macbook-pro-m3",
          "idPrice": 25000000,
          "enPrice": 1700,
          "imageUrl": "https://cdn.store.com/products/macbook.jpg",
          "category": {
            "id": "cat-1",
            "name": "Electronics"
          }
        },
        "variant": {
          "id": "variant-uuid-1",
          "variantName": "Space Gray 512GB",
          "sku": "MBP-M3-SG-512",
          "stock": 10,
          "images": [
            {
              "id": "img-1",
              "imageUrl": "https://cdn.store.com/variants/v1.jpg"
            }
          ]
        },
        "subtotal": 50000000,
        "createdAt": "2025-01-16T10:00:00.000Z"
      }
    ],
    "summary": {
      "totalItems": 2,
      "totalQuantity": 2,
      "subtotal": 50000000
    },
    "createdAt": "2025-01-15T08:00:00.000Z",
    "updatedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

**Response (200 OK) - Empty Cart:**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "cart-uuid-1",
    "userId": "user-uuid-1",
    "items": [],
    "summary": {
      "totalItems": 0,
      "totalQuantity": 0,
      "subtotal": 0
    },
    "createdAt": "2025-01-15T08:00:00.000Z",
    "updatedAt": "2025-01-15T08:00:00.000Z"
  }
}
```

---

## 2. Add Item to Cart

> **POST** `/cart/items`

**Description:**  
Menambahkan product variant ke cart. Jika item sudah ada, quantity akan di-update (ditambah).

**Authorization:** Required (USER)

**Request Body:**
```json
{
  "variantId": "variant-uuid-1",
  "quantity": 2
}
```

**Validation Rules:**
- `variantId`: Required, valid UUID, variant must exist and be active
- `quantity`: Required, integer, min: 1, max: available stock

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Item added to cart successfully",
  "data": {
    "id": "cart-item-uuid-1",
    "cartId": "cart-uuid-1",
    "productId": "product-uuid-1",
    "variantId": "variant-uuid-1",
    "quantity": 2,
    "product": {
      "id": "product-uuid-1",
      "name": "MacBook Pro M3",
      "idPrice": 25000000,
      "enPrice": 1700,
      "imageUrl": "https://cdn.store.com/products/macbook.jpg"
    },
    "variant": {
      "id": "variant-uuid-1",
      "variantName": "Space Gray 512GB",
      "sku": "MBP-M3-SG-512",
      "stock": 8
    },
    "subtotal": 50000000,
    "createdAt": "2025-01-16T10:30:00.000Z"
  }
}
```

**Error (400 Bad Request) - Insufficient Stock:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Insufficient stock",
  "errors": [
    {
      "field": "quantity",
      "message": "Requested quantity (5) exceeds available stock (3)"
    }
  ]
}
```

**Error (404 Not Found) - Variant Not Found:**
```json
{
  "status": "error",
  "code": 404,
  "message": "Product variant not found or inactive"
}
```

---

## 3. Update Cart Item Quantity

> **PATCH** `/cart/items/:id`

**Description:**  
Mengupdate quantity item di cart. Set quantity = 0 untuk menghapus item.

**Authorization:** Required (USER, can only update own cart)

**Path Parameters:**
- `id`: Cart item ID

**Request Body:**
```json
{
  "quantity": 3
}
```

**Validation Rules:**
- `quantity`: Required, integer, min: 0, max: available stock

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Cart item updated successfully",
  "data": {
    "id": "cart-item-uuid-1",
    "quantity": 3,
    "subtotal": 75000000,
    "variant": {
      "id": "variant-uuid-1",
      "stock": 7
    },
    "updatedAt": "2025-01-16T11:00:00.000Z"
  }
}
```

**Response (200 OK) - Item Removed (quantity = 0):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Cart item removed successfully"
}
```

**Error (400 Bad Request) - Insufficient Stock:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Insufficient stock",
  "errors": [
    {
      "field": "quantity",
      "message": "Requested quantity (10) exceeds available stock (7)"
    }
  ]
}
```

**Error (404 Not Found):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Cart item not found"
}
```

---

## 4. Remove Item from Cart

> **DELETE** `/cart/items/:id`

**Description:**  
Menghapus item dari cart.

**Authorization:** Required (USER, can only delete from own cart)

**Path Parameters:**
- `id`: Cart item ID

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Item removed from cart successfully"
}
```

**Error (404 Not Found):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Cart item not found"
}
```

---

## 5. Clear Cart

> **DELETE** `/cart`

**Description:**  
Menghapus semua items dari cart user.

**Authorization:** Required (USER)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Cart cleared successfully",
  "data": {
    "removedItems": 5
  }
}
```

---

## **Business Logic & Validation**

### **Stock Validation**
- Setiap kali add/update item, sistem akan validate stock availability
- Jika stock tidak cukup, request akan ditolak dengan error message yang jelas
- Stock tidak di-hold saat item di cart (hanya di-hold saat order dibuat)

### **Automatic Quantity Update**
- Jika user add item yang sudah ada di cart, quantity akan otomatis bertambah
- Example: Cart sudah ada 2 MacBook → Add 1 MacBook lagi → Quantity jadi 3

### **Cart Persistence**
- Cart tersimpan di database, tidak hilang saat user logout
- One cart per user (unique constraint)

### **Inactive Products/Variants**
- Jika product atau variant menjadi inactive, item tetap ada di cart
- Saat checkout, akan ada validation untuk check active status
- Frontend should show warning jika ada inactive items

### **Price Calculation**
```javascript
// Cart item subtotal
itemSubtotal = variant.product.idPrice * quantity

// Cart total
cartSubtotal = sum(all,itemSubtotal)
```

---

## **Frontend Integration Guide**

### **1. Display Cart Badge**
```typescript
// Get cart to show item count
const response = await fetch('/api/v1/cart', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { data } = await response.json();
const itemCount = data.summary.totalItems; // Show in badge
```

### **2. Add to Cart Button**
```typescript
const addToCart = async (variantId: string, quantity: number) => {
  const response = await fetch('/api/v1/cart/items', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ variantId, quantity })
  });
  
  if (response.ok) {
    // Show success message
    // Update cart badge count
  } else {
    const error = await response.json();
    // Show error message (e.g., insufficient stock)
  }
};
```

### **3. Update Quantity in Cart**
```typescript
const updateCartItem = async (itemId: string, quantity: number) => {
  const response = await fetch(`/api/v1/cart/items/${itemId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ quantity })
  });
  
  // If quantity = 0, item will be removed
  // Refresh cart display
};
```

---

## **Error Handling**

### **Common Error Codes:**
- `400` - Invalid request (validation error, insufficient stock)
- `401` - Unauthorized (invalid/expired token)
- `404` - Item/variant not found
- `500` - Internal server error

### **Stock Validation Errors:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Insufficient stock",
  "errors": [
    {
      "field": "quantity",
      "message": "Requested quantity (5) exceeds available stock (3)",
      "availableStock": 3
    }
  ]
}
```

---

## **Database Schema Reference**

```prisma
model Cart {
  id        String     @id @default(uuid())
  userId    String     @unique
  items     CartItem[]
  createdAt DateTime
  updatedAt DateTime
}

model CartItem {
  id        String   @id @default(uuid())
  cartId    String
  productId String
  variantId String   @unique // One variant per cart
  quantity  Int
  createdAt DateTime
  updatedAt DateTime
}
```
