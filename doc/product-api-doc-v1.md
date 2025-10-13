# 🛍️ Product Management API Documentation

**Version:** 1.0.0  
**Last Updated:** January 16, 2025  
**Base URL:** `http://localhost:3000/api`

---

## **Table of Contents**
- [Authentication](#authentication)
- [Public API - Products](#public-api---products)
- [Public API - Categories](#public-api---categories)
- [Public API - Tags](#public-api---tags)
- [Public API - Promotions](#public-api---promotions)
- [Protected API - Reviews](#protected-api---reviews)
- [Admin API - Products](#admin-api---products)
- [Admin API - Categories](#admin-api---categories)
- [Admin API - Tags](#admin-api---tags)
- [Admin API - Promotions](#admin-api---promotions)
- [Admin API - Reviews](#admin-api---reviews)
- [Admin API - Statistics](#admin-api---statistics)

---

## **Authentication**

### **Public Endpoints** (No Auth Required)
- Product listings, details
- Categories, Tags, Promotions
- Active promotions

### **Protected Endpoints** (Require User Auth)
- User reviews (POST, PATCH, DELETE)

### **Admin Endpoints** (Require Admin/Owner Role)
- All `/admin/*` endpoints

**Authorization Header:**
```
Authorization: Bearer <access_token>
```

---

## **Standard Response Format**

### **Success Response**
```json
{
  "status": "success",
  "code": 200,
  "message": "Optional message",
  "data": {  },
  "meta": {  }
}
```

### **Error Response**
```json
{
  "status": "error",
  "code": 400,
  "message": "Error message",
  "errors": [
    {
      "field": "field_name",
      "message": "Error description"
    }
  ]
}
```

---

# 📦 Public API - Products

## 1. Get All Products

> **GET** `/products`

**Description:**
Get list of all active products with filtering, sorting, and pagination.

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20, max: 100)
- `search` (string) - Search by name or description
- `categoryId` (string)
- `categorySlug` (string)
- `tagId` (string)
- `tagSlug` (string)
- `minPrice` (integer)
- `maxPrice` (integer)
- `isFeatured` (boolean)
- `isPreOrder` (boolean)
- `sortBy` (string) - `name`, `idPrice`, `totalSold`, `avgRating`, `createdAt`
- `order` (string) - `asc`, `desc`

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [
    {
      "id": "uuid-1",
      "name": "MacBook Pro M3",
      "slug": "macbook-pro-m3",
      "idPrice": 25000000,
      "enPrice": 1700,
      "imageUrl": "https://cdn.store.com/products/macbook.jpg",
      "totalSold": 150,
      "totalView": 5420,
      "avgRating": 4.8,
      "isFeatured": true,
      "isPreOrder": false,
      "category": {
        "id": "cat-1",
        "name": "Electronics",
        "slug": "electronics"
      },
      "tags": [
        {
          "id": "tag-1",
          "name": "Trending",
          "slug": "trending"
        }
      ]
    }
  ]
}
```

---

## 2. Get Product Detail

> **GET** `/products/:slug`

**Path Parameters:**
- `slug` (string, required)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "uuid-1",
    "name": "MacBook Pro M3",
    "slug": "macbook-pro-m3",
    "idDescription": "Laptop powerful dengan chip M3...",
    "enDescription": "Powerful laptop with M3 chip...",
    "idPrice": 25000000,
    "enPrice": 1700,
    "imageUrl": "https://cdn.store.com/products/macbook.jpg",
    "totalSold": 150,
    "totalView": 5421,
    "avgRating": 4.8,
    "weight": 1600,
    "height": 2,
    "length": 30,
    "width": 21,
    "taxRate": 0.11,
    "isFeatured": true,
    "isPreOrder": false,
    "preOrderDays": 0,
    "category": {
      "id": "cat-1",
      "name": "Electronics",
      "slug": "electronics"
    },
    "promotion": {
      "id": "promo-1",
      "name": "New Year Sale",
      "discount": 0.15,
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-01-31T23:59:59.000Z"
    },
    "tags": [
      {
        "id": "tag-1",
        "name": "Trending",
        "slug": "trending"
      }
    ],
    "variants": [
      {
        "id": "var-1",
        "variantName": "Space Gray 512GB",
        "sku": "MBP-M3-SG-512",
        "stock": 10,
        "isActive": true,
        "images": [
          {
            "id": "img-1",
            "imageUrl": "https://cdn.store.com/variants/mbp-sg-1.jpg"
          }
        ]
      }
    ],
    "reviews": [
      {
        "id": "rev-1",
        "userId": "user-1",
        "rating": 5,
        "comment": "Excellent product!",
        "images": [
          {
            "id": "rev-img-1",
            "imageUrl": "https://cdn.store.com/reviews/rev-1-img-1.jpg"
          }
        ],
        "createdAt": "2025-01-10T14:30:00.000Z"
      }
    ],
    "createdAt": "2025-01-01T10:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## 3. Get Featured Products

> **GET** `/products/featured`

**Query Parameters:**
- `limit` (integer, default: 10)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "uuid-1",
      "name": "MacBook Pro M3",
      "slug": "macbook-pro-m3",
      "idPrice": 25000000,
      "imageUrl": "https://cdn.store.com/products/macbook.jpg",
      "avgRating": 4.8
    }
  ]
}
```

---

## 4. Get Best Sellers

> **GET** `/products/best-sellers`

**Query Parameters:**
- `limit` (integer, default: 10)
- `categorySlug` (string)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "uuid-1",
      "name": "MacBook Pro M3",
      "slug": "macbook-pro-m3",
      "idPrice": 25000000,
      "imageUrl": "https://cdn.store.com/products/macbook.jpg",
      "totalSold": 150,
      "avgRating": 4.8
    }
  ]
}
```

---

## 5. Get Trending Products

> **GET** `/products/trending`

**Query Parameters:**
- `limit` (integer, default: 10)
- `days` (integer, default: 7)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "uuid-1",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "idPrice": 18000000,
      "imageUrl": "https://cdn.store.com/products/iphone.jpg",
      "totalView": 12450,
      "avgRating": 4.9,
      "trendingScore": 8.5
    }
  ]
}
```

---

# 📁 Public API - Categories

## 6. Get All Categories

> **GET** `/categories`

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "cat-1",
      "name": "Electronics",
      "slug": "electronics",
      "productCount": 45,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 7. Get Category Detail

> **GET** `/categories/:slug`

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "cat-1",
    "name": "Electronics",
    "slug": "electronics",
    "isActive": true,
    "productCount": 45,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

## 8. Get Products by Category

> **GET** `/categories/:slug/products`

**Query Parameters:** Same as Get All Products

**Response:** Same format as Get All Products

---

# 🏷️ Public API - Tags

## 9. Get All Tags

> **GET** `/tags`

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "tag-1",
      "name": "Trending",
      "slug": "trending",
      "productCount": 25
    }
  ]
}
```

---

## 10. Get Tag Detail

> **GET** `/tags/:slug`

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "tag-1",
    "name": "Trending",
    "slug": "trending",
    "productCount": 25
  }
}
```

---

## 11. Get Products by Tag

> **GET** `/tags/:slug/products`

**Query Parameters:** Same as Get All Products

**Response:** Same format as Get All Products

---

# 🎁 Public API - Promotions

## 12. Get Active Promotions

> **GET** `/promotions/active`

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "promo-1",
      "name": "New Year Sale",
      "discount": 0.15,
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-01-31T23:59:59.000Z",
      "productCount": 20
    }
  ]
}
```

---

## 13. Get Promotion Detail

> **GET** `/promotions/:id`

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "promo-1",
    "name": "New Year Sale",
    "discount": 0.15,
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-01-31T23:59:59.000Z",
    "isActive": true,
    "productCount": 20
  }
}
```

---

## 14. Get Products by Promotion

> **GET** `/promotions/:id/products`

**Query Parameters:** Same as Get All Products

**Response:** Same format as Get All Products

---

# ⭐ Protected API - Reviews

## 15. Create Review

> **POST** `/reviews`

**Authorization:** Required (User)

**Request Headers:**
```json
{
  "Authorization": "Bearer <access_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "productId": "uuid-1",
  "rating": 5,
  "comment": "Excellent product!",
  "imageUrls": [
    "https://cdn.store.com/review-uploads/img1.jpg",
    "https://cdn.store.com/review-uploads/img2.jpg"
  ]
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Review created successfully",
  "data": {
    "id": "rev-new",
    "userId": "user-1",
    "productId": "uuid-1",
    "rating": 5,
    "comment": "Excellent product!",
    "images": [
      {
        "id": "rev-img-1",
        "imageUrl": "https://cdn.store.com/review-uploads/img1.jpg"
      },
      {
        "id": "rev-img-2",
        "imageUrl": "https://cdn.store.com/review-uploads/img2.jpg"
      }
    ],
    "createdAt": "2025-01-16T09:00:00.000Z"
  }
}
```

---

## 16. Update Review

> **PATCH** `/reviews/:id`

**Authorization:** Required (User can only update own review)

**Request Body:**
```json
{
  "rating": 4,
  "comment": "Updated review",
  "imageUrls": [
    "https://cdn.store.com/review-uploads/img1-updated.jpg"
  ]
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Review updated successfully",
  "data": {
    "id": "rev-1",
    "rating": 4,
    "comment": "Updated review",
    "images": [
      {
        "id": "rev-img-1",
        "imageUrl": "https://cdn.store.com/review-uploads/img1-updated.jpg"
      }
    ],
    "updatedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

---

## 17. Delete Review

> **DELETE** `/reviews/:id`

**Authorization:** Required (User can only delete own review)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Review deleted successfully"
}
```

---

# 📊 Public API - Statistics

## 18. Increment Product View

> **POST** `/products/:id/increment-view`

**Request Body:**
```json
{}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "View count incremented",
  "data": {
    "productId": "uuid-1",
    "totalView": 5422
  }
}
```

---

# 🔐 Admin API - Products

## 19. Get All Products (Admin)

> **GET** `/admin/products`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- All public product params, plus:
- `includeDeleted` (boolean)
- `isActive` (boolean)

**Response (200 OK):**
Same format as public product list, but includes `deletedAt` field

---

## 20. Get Product Detail (Admin)

> **GET** `/admin/products/:id`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
Same format as public product detail, but includes `deletedAt` field

---

## 21. Create Product

> **POST** `/admin/products`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{
  "name": "MacBook Pro M3",
  "slug": "macbook-pro-m3",
  "idDescription": "Laptop powerful untuk profesional",
  "enDescription": "Powerful laptop for professionals",
  "idPrice": 25000000,
  "enPrice": 1700,
  "imageUrl": "https://cdn.store.com/products/macbook.jpg",
  "weight": 1600,
  "height": 2,
  "length": 30,
  "width": 21,
  "taxRate": 0.11,
  "categoryId": "cat-1",
  "promotionId": "promo-1",
  "isFeatured": false,
  "isPreOrder": false,
  "preOrderDays": 0,
  "variants": [
    {
      "variantName": "Space Gray 512GB",
      "sku": "MBP-M3-SG-512",
      "stock": 10,
      "isActive": true,
      "imageUrls": [
        "https://cdn.store.com/variants/v1-img1.jpg",
        "https://cdn.store.com/variants/v1-img2.jpg"
      ]
    }
  ],
  "tagIds": ["tag-1", "tag-2"]
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Product created successfully with 1 variant",
  "data": {
    "id": "uuid-new",
    "name": "MacBook Pro M3",
    "slug": "macbook-pro-m3",
    "variants": [
      {
        "id": "var-new-1",
        "variantName": "Space Gray 512GB",
        "sku": "MBP-M3-SG-512",
        "stock": 10,
        "images": [
          {
            "id": "img-1",
            "imageUrl": "https://cdn.store.com/variants/v1-img1.jpg"
          }
        ]
      }
    ],
    "tags": [
      {
        "id": "tag-1",
        "name": "Trending",
        "slug": "trending"
      }
    ],
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

## 22. Update Product

> **PATCH** `/admin/products/:id`

**Authorization:** Required (Admin/Owner)

**Request Body (All optional):**
```json
{
  "name": "MacBook Pro M3 (Updated)",
  "idPrice": 26000000,
  "isActive": true,
  "isFeatured": true,
  "variants": [
    {
      "id": "var-1",
      "stock": 15,
      "imagesToDelete": ["img-old-1"],
      "newImageUrls": ["https://cdn.store.com/new-img.jpg"]
    },
    {
      "variantName": "New Variant",
      "sku": "NEW-SKU",
      "stock": 10,
      "imageUrls": ["https://cdn.store.com/variant-img.jpg"]
    },
    {
      "id": "var-3",
      "_delete": true
    }
  ],
  "tagIds": ["tag-1", "tag-2", "tag-4"]
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product updated successfully",
  "data": {
    "id": "uuid-1",
    "name": "MacBook Pro M3 (Updated)",
    "variants": [
      {
        "id": "var-1",
        "stock": 15,
        "images": [
          {
            "id": "img-new-1",
            "imageUrl": "https://cdn.store.com/new-img.jpg"
          }
        ]
      }
    ],
    "summary": {
      "variantsUpdated": 1,
      "variantsCreated": 1,
      "variantsDeleted": 1
    },
    "updatedAt": "2025-01-15T15:00:00.000Z"
  }
}
```

---

## 23. Soft Delete Product

> **DELETE** `/admin/products/:id`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product deleted successfully",
  "data": {
    "id": "uuid-1",
    "deletedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

---

## 24. Restore Product

> **POST** `/admin/products/:id/restore`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product restored successfully",
  "data": {
    "id": "uuid-1",
    "deletedAt": null,
    "restoredAt": "2025-01-16T11:00:00.000Z"
  }
}
```

---

## 25. Hard Delete Product

> **DELETE** `/admin/products/:id/permanent`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product permanently deleted"
}
```

---

# 📁 Admin API - Categories

## 26. Get All Categories (Admin)

> **GET** `/admin/categories`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- `includeInactive` (boolean)
- `includeDeleted` (boolean)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "cat-1",
      "name": "Electronics",
      "slug": "electronics",
      "isActive": true,
      "deletedAt": null,
      "productCount": 20,
      "createdAt": "2024-12-15T00:00:00.000Z"
    }
  ]
}
```


## 28. Create Category

> **POST** `/admin/categories`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{
  "name": "Electronics",
  "slug": "electronics"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Category created successfully",
  "data": {
    "id": "cat-new",
    "name": "Electronics",
    "slug": "electronics",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

## 29. Update Category

> **PATCH** `/admin/categories/:id`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{
  "name": "Consumer Electronics",
  "slug": "consumer-electronics",
  "isActive": true
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Category updated successfully",
  "data": {
    "id": "cat-1",
    "name": "Consumer Electronics",
    "slug": "consumer-electronics",
    "isActive": true,
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## 30. Soft Delete Category

> **DELETE** `/admin/categories/:id`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Category deleted successfully",
  "data": {
    "id": "cat-1",
    "deletedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

---

## 31. Restore Category

> **POST** `/admin/categories/:id/restore`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Category restored successfully",
  "data": {
    "id": "cat-1",
    "deletedAt": null
  }
}
```

---

## 32. Hard Delete Category

> **DELETE** `/admin/categories/:id/permanent`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Category permanently deleted"
}
```

---

# 🏷️ Admin API - Tags

## 33. Get All Tags (Admin)

> **GET** `/admin/tags`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- `includeInactive` (boolean)
- `includeDeleted` (boolean)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "tag-1",
      "name": "Trending",
      "slug": "trending",
      "isActive": true,
      "deletedAt": null,
      "productCount": 25,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 34. Get Tag Detail (Admin)

> **GET** `/admin/tags/:id`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "tag-1",
    "name": "Trending",
    "slug": "trending",
    "isActive": true,
    "deletedAt": null,
    "productCount": 25,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

## 35. Create Tag

> **POST** `/admin/tags`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{
  "name": "Trending",
  "slug": "trending"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Tag created successfully",
  "data": {
    "id": "tag-new",
    "name": "Trending",
    "slug": "trending",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

## 36. Update Tag

> **PATCH** `/admin/tags/:id`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{
  "name": "Hot Trending",
  "slug": "hot-trending",
  "isActive": true
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Tag updated successfully",
  "data": {
    "id": "tag-1",
    "name": "Hot Trending",
    "slug": "hot-trending",
    "isActive": true,
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## 37. Soft Delete Tag

> **DELETE** `/admin/tags/:id`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Tag deleted successfully",
  "data": {
    "id": "tag-1",
    "deletedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

---

## 38. Restore Tag

> **POST** `/admin/tags/:id/restore`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Tag restored successfully",
  "data": {
    "id": "tag-1",
    "deletedAt": null
  }
}
```

---

## 39. Hard Delete Tag

> **DELETE** `/admin/tags/:id/permanent`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Tag permanently deleted"
}
```

---

# 🎁 Admin API - Promotions

## 40. Get All Promotions (Admin)

> **GET** `/admin/promotions`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- `includeInactive` (boolean)
- `includeExpired` (boolean)
- `includeDeleted` (boolean)

**Response (200 OK):**
```json
{
    "status": "success",
    "code": 200,
    "data": {
      "id": "promo-1",
      "name": "New Year Sale",
      "discount": 0.15,
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-01-31T23:59:59.000Z",
      "isActive": true,
      "productCount": 20
    },
    "createdAt": "2024-12-15T00:00:00.000Z"
}

```

---

## 41. Get Promotion Detail (Admin)

> **GET** `/admin/promotions/:id`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "promo-1",
    "name": "New Year Sale",
    "discount": 0.15,
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-01-31T23:59:59.000Z",
    "isActive": true,
    "deletedAt": null,
    "productCount": 20,
    "products": [
      {
        "id": "uuid-1",
        "name": "MacBook Pro M3",
        "slug": "macbook-pro-m3",
        "idPrice": 25000000
      }
    ],
    "createdAt": "2024-12-15T00:00:00.000Z"
  }
}
```

---

## 42. Create Promotion

> **POST** `/admin/promotions`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{
  "name": "New Year Sale",
  "discount": 0.15,
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-01-31T23:59:59.000Z"
}
```

**Validation:**
- `name` (required, min 3, max 100)
- `discount` (required, float, 0-1, e.g., 0.15 for 15%)
- `startDate` (required, valid ISO date)
- `endDate` (required, valid ISO date, must be after startDate)

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Promotion created successfully",
  "data": {
    "id": "promo-new",
    "name": "New Year Sale",
    "discount": 0.15,
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-01-31T23:59:59.000Z",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

## 43. Update Promotion

> **PATCH** `/admin/promotions/:id`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{
  "name": "New Year Mega Sale",
  "discount": 0.20,
  "endDate": "2025-02-15T23:59:59.000Z",
  "isActive": true
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Promotion updated successfully",
  "data": {
    "id": "promo-1",
    "name": "New Year Mega Sale",
    "discount": 0.20,
    "endDate": "2025-02-15T23:59:59.000Z",
    "isActive": true,
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## 44. Soft Delete Promotion

> **DELETE** `/admin/promotions/:id`

**Authorization:** Required (Admin/Owner)

**Description:**
Soft delete a promotion. Products will have promotionId set to null.

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Promotion deleted successfully",
  "data": {
    "id": "promo-1",
    "deletedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

---

## 45. Restore Promotion

> **POST** `/admin/promotions/:id/restore`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Promotion restored successfully",
  "data": {
    "id": "promo-1",
    "deletedAt": null
  }
}
```

---

## 46. Hard Delete Promotion

> **DELETE** `/admin/promotions/:id/permanent`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Promotion permanently deleted"
}
```

---

## 47. Assign Product to Promotion

> **POST** `/admin/promotions/:id/products/:productId`

**Authorization:** Required (Admin/Owner)

**Request Body:**
```json
{}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Product assigned to promotion successfully",
  "data": {
    "productId": "uuid-1",
    "promotionId": "promo-1",
    "productName": "MacBook Pro M3",
    "promotionName": "New Year Sale",
    "discount": 0.15
  }
}
```

**Error (409):**
```json
{
  "status": "error",
  "code": 409,
  "message": "Product already has an active promotion"
}
```

---

## 48. Remove Product from Promotion

> **DELETE** `/admin/promotions/:id/products/:productId`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product removed from promotion successfully"
}
```

---

# ⭐ Admin API - Reviews Management

## 49. Get All Reviews (Admin)

> **GET** `/admin/reviews`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `productId` (string) - Filter by product
- `rating` (integer) - Filter by rating (1-5)
- `sortBy` (string) - Sort by: `createdAt`, `rating`
- `order` (string) - `asc`, `desc`

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
      "id": "rev-1",
      "userId": "user-1",
      "user": {
        "id": "user-1",
        "username": "johndoe",
        "email": "john@example.com"
      },
      "productId": "uuid-1",
      "product": {
        "id": "uuid-1",
        "name": "MacBook Pro M3",
        "slug": "macbook-pro-m3"
      },
      "rating": 5,
      "comment": "Excellent product!",
      "images": [
        {
          "id": "rev-img-1",
          "imageUrl": "https://cdn.store.com/reviews/img1.jpg"
        }
      ],
      "createdAt": "2025-01-15T14:30:00.000Z"
    }
  ]
}
```

---

## 50. Get Review Detail (Admin)

> **GET** `/admin/reviews/:id`

**Authorization:** Required (Admin/Owner)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "rev-1",
    "userId": "user-1",
    "user": {
      "id": "user-1",
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "productId": "uuid-1",
    "product": {
      "id": "uuid-1",
      "name": "MacBook Pro M3",
      "slug": "macbook-pro-m3",
      "imageUrl": "https://cdn.store.com/products/macbook.jpg"
    },
    "rating": 5,
    "comment": "Excellent product! Highly recommended.",
    "images": [
      {
        "id": "rev-img-1",
        "imageUrl": "https://cdn.store.com/reviews/img1.jpg"
      },
      {
        "id": "rev-img-2",
        "imageUrl": "https://cdn.store.com/reviews/img2.jpg"
      }
    ],
    "createdAt": "2025-01-15T14:30:00.000Z",
    "updatedAt": "2025-01-15T14:30:00.000Z"
  }
}
```

---

## 51. Delete Review (Admin)

> **DELETE** `/admin/reviews/:id`

**Authorization:** Required (Admin/Owner)

**Description:**
Delete a review (moderation/spam removal).

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Review deleted successfully"
}
```

---

## 52. Get Reviews by Product (Admin)

> **GET** `/admin/products/:productId/reviews`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `rating` (integer) - Filter by rating (1-5)
- `sortBy` (string) - Sort by: `createdAt`, `rating`
- `order` (string) - `asc`, `desc`

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false,
    "productInfo": {
      "id": "uuid-1",
      "name": "MacBook Pro M3",
      "slug": "macbook-pro-m3",
      "avgRating": 4.8,
      "totalReviews": 45
    }
  },
  "data": [
    {
      "id": "rev-1",
      "userId": "user-1",
      "user": {
        "id": "user-1",
        "username": "johndoe",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "profileImage": "https://cdn.store.com/users/john.jpg"
      },
      "productId": "uuid-1",
      "rating": 5,
      "comment": "Excellent product! The M3 chip is incredibly fast.",
      "images": [
        {
          "id": "rev-img-1",
          "imageUrl": "https://cdn.store.com/reviews/rev-1-img-1.jpg"
        },
        {
          "id": "rev-img-2",
          "imageUrl": "https://cdn.store.com/reviews/rev-1-img-2.jpg"
        }
      ],
      "createdAt": "2025-01-15T14:30:00.000Z",
      "updatedAt": "2025-01-15T14:30:00.000Z"
    }
  ],
  "statistics": {
    "avgRating": 4.8,
    "totalReviews": 45,
    "ratingDistribution": {
      "5": 35,
      "4": 8,
      "3": 1,
      "2": 1,
      "1": 0
    }
  }
}
```

---

# 📊 Admin API - Statistics & Reports

## 53. Get Product Statistics

> **GET** `/admin/products/:id/statistics`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- `days` (integer, default: 30) - Statistics for last N days

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "productId": "uuid-1",
    "productName": "MacBook Pro M3",
    "period": {
      "days": 30,
      "startDate": "2024-12-17T00:00:00.000Z",
      "endDate": "2025-01-16T00:00:00.000Z"
    },
    "sales": {
      "totalSold": 150,
      "totalRevenue": 3750000000
    },
    "engagement": {
      "totalViews": 5421,
      "avgRating": 4.8,
      "totalReviews": 45
    },
    "inventory": {
      "totalStock": 25,
      "lowStockVariants": [
        {
          "id": "var-2",
          "variantName": "Silver 1TB",
          "stock": 5
        }
      ]
    }
  }
}
```

---

## 54. Export Products

> **GET** `/admin/products/export`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- `format` (string) - `csv` or `xlsx` (default: csv)
- Other filter params (same as Get All Products)

**Response (200 OK):**
Returns a downloadable file with:
- `Content-Type: text/csv` for CSV format
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for XLSX format
- `Content-Disposition: attachment; filename="products_export_2025-01-16.csv"`

---

## 55. Get Dashboard Summary

> **GET** `/admin/dashboard/summary`

**Authorization:** Required (Admin/Owner)

**Query Parameters:**
- `period` (string) - `today`, `week`, `month`, `year` (default: month)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "period": "month",
    "products": {
      "total": 450,
      "active": 420,
      "inactive": 30,
      "outOfStock": 15
    },
    "sales": {
      "totalOrders": 1250,
      "totalRevenue": 156750000000,
      "avgOrderValue": 125400000
    },
    "reviews": {
      "total": 850,
      "avgRating": 4.6,
      "pending": 12
    },
    "topProducts": [
      {
        "id": "uuid-1",
        "name": "MacBook Pro M3",
        "totalSold": 150,
        "revenue": 3750000000
      }
    ]
  }
}
```

