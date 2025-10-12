# 🛍️ Product Management API Documentation


---

# 📦 Public API - Products

## 1. Get All Products

> **GET** `/products`

**Description:**
Get list of all active products with filtering, sorting, and pagination.

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20, max: 100) - Items per page
- `search` (string) - Search by product name or description
- `categoryId` (string) - Filter by category ID
- `categorySlug` (string) - Filter by category slug
- `tagId` (string) - Filter by tag ID
- `tagSlug` (string) - Filter by tag slug
- `minPrice` (integer) - Minimum price filter
- `maxPrice` (integer) - Maximum price filter
- `isFeatured` (boolean) - Filter featured products
- `isPreOrder` (boolean) - Filter pre-order products
- `sortBy` (string) - Sort by: `name`, `idPrice`, `enPrice`, `totalSold`, `totalView`, `avgRating`, `createdAt`
- `order` (string) - Order: `asc`, `desc` (default: `desc`)

**Example Request:**
```http
GET /products?page=1&limit=20&categorySlug=electronics&minPrice=1000000&maxPrice=5000000&sortBy=totalSold&order=desc
```

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
      "idDescription": "Laptop powerful untuk profesional",
      "enDescription": "Powerful laptop for professionals",
      "idPrice": 25000000,
      "enPrice": 1700,
      "imageUrl": "https://cdn.store.com/products/macbook.jpg",
      "totalSold": 150,
      "totalView": 5420,
      "avgRating": 4.8,
      "weight": 1600,
      "taxRate": 0.11,
      "isFeatured": true,
      "isPreOrder": false,
      "category": {
        "id": "cat-1",
        "name": "Electronics",
        "slug": "electronics"
      },
      "promotion": {
        "id": "promo-1",
        "name": "New Year Sale",
        "discount": 0.15
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
          "stock": 10
        }
      ],
      "createdAt": "2025-01-01T10:00:00.000Z"
    }
  ]
}
```

---

## 2. Get Product Detail

> **GET** `/products/:slug`

**Description:**
Get detailed information of a product by slug (SEO-friendly).

**Path Parameters:**
- `slug` (string, required) - Product slug

**Example Request:**
```http
GET /products/macbook-pro-m3
```

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
      },
      {
        "id": "tag-2",
        "name": "Premium",
        "slug": "premium"
      }
    ],
    "variants": [
      {
        "id": "var-1",
        "variantName": "Space Gray 512GB",
        "sku": "MBP-M3-SG-512",
        "stock": 10,
        "images": [
          {
            "id": "img-1",
            "imageUrl": "https://cdn.store.com/variants/mbp-sg-1.jpg"
          }
        ]
      },
      {
        "id": "var-2",
        "variantName": "Silver 1TB",
        "sku": "MBP-M3-SV-1TB",
        "stock": 5,
        "images": [
          {
            "id": "img-2",
            "imageUrl": "https://cdn.store.com/variants/mbp-sv-1.jpg"
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
          "https://cdn.store.com/reviews/rev-1-img-1.jpg"
        ],
        "createdAt": "2025-01-10T14:30:00.000Z"
      }
    ],
    "createdAt": "2025-01-01T10:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Product not found"
}
```

---

## 3. Get Featured Products

> **GET** `/products/featured`

**Description:**
Get list of featured products (for homepage banner/carousel).

**Query Parameters:**
- `limit` (integer, default: 10) - Number of products to return

**Example Request:**
```http
GET /products/featured?limit=10
```

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
      "enPrice": 1700,
      "imageUrl": "https://cdn.store.com/products/macbook.jpg",
      "avgRating": 4.8,
      "totalSold": 150
    }
  ]
}
```

---

## 4. Get Best Sellers

> **GET** `/products/best-sellers`

**Description:**
Get list of best-selling products sorted by total sold.

**Query Parameters:**
- `limit` (integer, default: 10) - Number of products to return
- `categorySlug` (string) - Filter by category

**Example Request:**
```http
GET /products/best-sellers?limit=10&categorySlug=electronics
```

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
      "enPrice": 1700,
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

**Description:**
Get list of trending products based on views and ratings.

**Query Parameters:**
- `limit` (integer, default: 10) - Number of products to return
- `days` (integer, default: 7) - Calculate trending for last N days

**Example Request:**
```http
GET /products/trending?limit=10&days=7
```

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
      "enPrice": 1200,
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

**Description:**
Get list of all active categories.

**Query Parameters:**
- `isActive` (boolean) - Filter by active status (default: true)

**Example Request:**
```http
GET /categories?isActive=true
```

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
    },
    {
      "id": "cat-2",
      "name": "Fashion",
      "slug": "fashion",
      "productCount": 120,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 7. Get Category Detail

> **GET** `/categories/:slug`

**Description:**
Get category detail by slug.

**Path Parameters:**
- `slug` (string, required) - Category slug

**Example Request:**
```http
GET /categories/electronics
```

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
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-10T00:00:00.000Z"
  }
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Category not found"
}
```

---

## 8. Get Products by Category

> **GET** `/categories/:slug/products`

**Description:**
Get all products in a specific category.

**Path Parameters:**
- `slug` (string, required) - Category slug

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `sortBy` (string) - Same as product list
- `order` (string) - `asc` or `desc`

**Example Request:**
```http
GET /categories/electronics/products?page=1&limit=20&sortBy=totalSold&order=desc
```

**Response (200 OK):**
Same format as Get All Products

---

# 🏷️ Public API - Tags

## 9. Get All Tags

> **GET** `/tags`

**Description:**
Get list of all active tags.

**Example Request:**
```http
GET /tags
```

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
    },
    {
      "id": "tag-2",
      "name": "Premium",
      "slug": "premium",
      "productCount": 15
    }
  ]
}
```

---

## 10. Get Tag Detail

> **GET** `/tags/:slug`

**Description:**
Get tag detail by slug.

**Path Parameters:**
- `slug` (string, required) - Tag slug

**Example Request:**
```http
GET /tags/trending
```

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
    "productCount": 25,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Tag not found"
}
```

---

## 11. Get Products by Tag

> **GET** `/tags/:slug/products`

**Description:**
Get all products with a specific tag.

**Path Parameters:**
- `slug` (string, required) - Tag slug

**Query Parameters:**
Same as product list

**Example Request:**
```http
GET /tags/trending/products?page=1&limit=20
```

**Response (200 OK):**
Same format as Get All Products

---

# 🎁 Public API - Promotions

## 12. Get Active Promotions

> **GET** `/promotions/active`

**Description:**
Get list of currently active promotions.

**Example Request:**
```http
GET /promotions/active
```

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

**Description:**
Get promotion detail by ID.

**Path Parameters:**
- `id` (string, required) - Promotion ID

**Example Request:**
```http
GET /promotions/promo-1
```

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
    "productCount": 20,
    "createdAt": "2024-12-15T00:00:00.000Z"
  }
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Promotion not found"
}
```

---

## 14. Get Products by Promotion

> **GET** `/promotions/:id/products`

**Description:**
Get all products in a specific promotion.

**Path Parameters:**
- `id` (string, required) - Promotion ID

**Query Parameters:**
Same as product list

**Example Request:**
```http
GET /promotions/promo-1/products?page=1&limit=20
```

**Response (200 OK):**
Same format as Get All Products

---

# ⭐ Protected API - Reviews

## 15. Create Review

> **POST** `/reviews`

**Authorization:** Required (User must be authenticated)

**Description:**
Create a review for a product.

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
  "comment": "Excellent product! Highly recommended.",
  "images": [
    "https://cdn.store.com/review-uploads/img1.jpg",
    "https://cdn.store.com/review-uploads/img2.jpg"
  ]
}
```

**Validation:**
- `productId` (required, must exist)
- `rating` (required, integer, 1-5)
- `comment` (optional, max 1000 characters)
- `images` (optional, array of image URLs, max 5 images)

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
    "comment": "Excellent product! Highly recommended.",
    "images": [
      "https://cdn.store.com/review-uploads/img1.jpg",
      "https://cdn.store.com/review-uploads/img2.jpg"
    ],
    "createdAt": "2025-01-16T09:00:00.000Z"
  }
}
```

**Error (400):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "rating",
      "message": "Rating must be between 1 and 5"
    }
  ]
}
```

**Error (409):**
```json
{
  "status": "error",
  "code": 409,
  "message": "You have already reviewed this product"
}
```

---

## 16. Update Review

> **PATCH** `/reviews/:id`

**Authorization:** Required (User can only update their own review)

**Description:**
Update user's own review.

**Path Parameters:**
- `id` (string, required) - Review ID

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
  "rating": 4,
  "comment": "Updated review comment",
  "images": [
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
    "comment": "Updated review comment",
    "images": [
      "https://cdn.store.com/review-uploads/img1-updated.jpg"
    ],
    "updatedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

**Error (403):**
```json
{
  "status": "error",
  "code": 403,
  "message": "You can only update your own review"
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Review not found"
}
```

---

## 17. Delete Review

> **DELETE** `/reviews/:id`

**Authorization:** Required (User can only delete their own review)

**Description:**
Delete user's own review.

**Path Parameters:**
- `id` (string, required) - Review ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <access_token>"
}
```

**Example Request:**
```http
DELETE /reviews/rev-1
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Review deleted successfully"
}
```

**Error (403):**
```json
{
  "status": "error",
  "code": 403,
  "message": "You can only delete your own review"
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Review not found"
}
```

---

# 📊 Public API - Statistics

## 18. Increment Product View

> **POST** `/products/:id/increment-view`

**Description:**
Increment product view count (called when user views product detail).

**Path Parameters:**
- `id` (string, required) - Product ID

**Request Body:**
```json
{}
```

**Example Request:**
```http
POST /products/uuid-1/increment-view
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

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Product not found"
}
```

---

# 🔐 Admin API - Products

## 19. Get All Products (Admin)

> **GET** `/admin/products`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get all products including inactive and soft-deleted products.

**Query Parameters:**
- All public product query params, plus:
- `includeDeleted` (boolean) - Include soft-deleted products
- `isActive` (boolean) - Filter by active status

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/products?page=1&limit=20&includeDeleted=true
```

**Response (200 OK):**
Same format as public product list

---

## 20. Get Product Detail (Admin)

> **GET** `/admin/products/:id`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get product detail by ID (can access inactive/deleted products).

**Path Parameters:**
- `id` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/products/uuid-1
```

**Response (200 OK):**
Same format as public product detail

---

## 21. Create Product

> **POST** `/admin/products`

**Authorization:** Required (Admin/Owner role)

**Description:**
Create a new product with variants and images in a single request.

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

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
    },
    {
      "variantName": "Silver 1TB",
      "sku": "MBP-M3-SV-1TB",
      "stock": 5,
      "isActive": true,
      "imageUrls": [
        "https://cdn.store.com/variants/v2-img1.jpg"
      ]
    }
  ],
  "tagIds": ["tag-1", "tag-2", "tag-3"]
}
```

**Validation:**
- `name` (required, min 3, max 255)
- `slug` (required, unique, lowercase, alphanumeric with hyphens)
- `idDescription` (optional, max 5000)
- `enDescription` (optional, max 5000)
- `idPrice` (required, integer, min 0)
- `enPrice` (required, integer, min 0)
- `imageUrl` (optional)
- `weight`, `height`, `length`, `width` (optional, integer)
- `taxRate` (optional, float, 0-1)
- `categoryId` (optional, must exist)
- `variants` (optional, array of variant objects)
  - Each variant requires: `variantName`, `sku`, `stock`
  - `imageUrls` (optional, array of image URLs)
- `tagIds` (optional, array of valid tag IDs)

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Product created successfully with 2 variants",
  "data": {
    "id": "uuid-new",
    "name": "MacBook Pro M3",
    "slug": "macbook-pro-m3",
    "idPrice": 25000000,
    "enPrice": 1700,
    "imageUrl": "https://cdn.store.com/products/macbook.jpg",
    "categoryId": "cat-1",
    "isFeatured": false,
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
          },
          {
            "id": "img-2",
            "imageUrl": "https://cdn.store.com/variants/v1-img2.jpg"
          }
        ]
      },
      {
        "id": "var-new-2",
        "variantName": "Silver 1TB",
        "sku": "MBP-M3-SV-1TB",
        "stock": 5,
        "images": [
          {
            "id": "img-3",
            "imageUrl": "https://cdn.store.com/variants/v2-img1.jpg"
          }
        ]
      }
    ],
    "tags": [
      {
        "id": "tag-1",
        "name": "Trending",
        "slug": "trending"
      },
      {
        "id": "tag-2",
        "name": "Premium",
        "slug": "premium"
      }
    ],
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Error (400):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "slug",
      "message": "Slug already exists"
    },
    {
      "field": "variants[0].sku",
      "message": "SKU already exists"
    }
  ]
}
```

---

## 22. Update Product

> **PATCH** `/admin/products/:id`

**Authorization:** Required (Admin/Owner role)

**Description:**
Update product with all its variants, images, and tags in a single request.

**Path Parameters:**
- `id` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

**Request Body (All fields optional):**
```json
{
  "name": "MacBook Pro M3 (Updated)",
  "slug": "macbook-pro-m3-updated",
  "idDescription": "Updated Indonesian description",
  "enDescription": "Updated English description",
  "idPrice": 26000000,
  "enPrice": 1750,
  "imageUrl": "https://cdn.store.com/products/new-image.jpg",
  "weight": 1600,
  "height": 2,
  "length": 30,
  "width": 21,
  "taxRate": 0.11,
  "categoryId": "cat-2",
  "promotionId": "promo-1",
  "isActive": true,
  "isFeatured": true,
  "isPreOrder": true,
  "preOrderDays": 14,
  "variants": [
    {
      "id": "var-1",
      "variantName": "Space Gray 512GB (Updated)",
      "sku": "MBP-M3-SG-512",
      "stock": 15,
      "isActive": true,
      "imagesToDelete": ["img-old-1"],
      "imagesToKeep": ["img-2", "img-3"],
      "newImageUrls": ["https://cdn.store.com/new-img.jpg"]
    },
    {
      "variantName": "Space Gray 1TB",
      "sku": "MBP-M3-SG-1TB",
      "stock": 8,
      "isActive": true,
      "imageUrls": [
        "https://cdn.store.com/variants/new-var-img1.jpg",
        "https://cdn.store.com/variants/new-var-img2.jpg"
      ]
    },
    {
      "id": "var-3",
      "_delete": true
    }
  ],
  "tagIds": ["tag-1", "tag-2", "tag-4"]
}
```

**Alternative: Incremental Tag Update**
```json
{
  "name": "MacBook Pro M3 (Updated)",
  "addTagIds": ["tag-5", "tag-6"],
  "removeTagIds": ["tag-1"]
}
```

**Validation:**
- Same as Create Product
- `variants` can contain mix of existing (with `id`) and new variants (without `id`)
- Variants with `_delete: true` will be soft-deleted
- For variant images:
  - `imagesToDelete`: Array of image IDs to delete
  - `imagesToKeep`: Array of image IDs to keep
  - `newImageUrls`: Array of new image URLs
  - `imageUrls`: Array of image URLs (for new variants)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product updated successfully. 1 variant updated, 1 variant created, 1 variant deleted",
  "data": {
    "id": "uuid-1",
    "name": "MacBook Pro M3 (Updated)",
    "slug": "macbook-pro-m3-updated",
    "idPrice": 26000000,
    "enPrice": 1750,
    "imageUrl": "https://cdn.store.com/products/macbook-new.jpg",
    "isActive": true,
    "isFeatured": true,
    "isPreOrder": true,
    "preOrderDays": 14,
    "variants": [
      {
        "id": "var-1",
        "variantName": "Space Gray 512GB (Updated)",
        "sku": "MBP-M3-SG-512",
        "stock": 15,
        "isActive": true,
        "images": [
          {
            "id": "img-2",
            "imageUrl": "https://cdn.store.com/variants/img2.jpg"
          },
          {
            "id": "img-new-1",
            "imageUrl": "https://cdn.store.com/variants/new-img1.jpg"
          }
        ]
      },
      {
        "id": "var-new-1",
        "variantName": "Space Gray 1TB",
        "sku": "MBP-M3-SG-1TB",
        "stock": 8,
        "isActive": true,
        "images": [
          {
            "id": "img-new-2",
            "imageUrl": "https://cdn.store.com/variants/new-var-img1.jpg"
          },
          {
            "id": "img-new-3",
            "imageUrl": "https://cdn.store.com/variants/new-var-img2.jpg"
          }
        ]
      }
    ],
    "tags": [
      {
        "id": "tag-1",
        "name": "Trending",
        "slug": "trending"
      },
      {
        "id": "tag-2",
        "name": "Premium",
        "slug": "premium"
      },
      {
        "id": "tag-4",
        "name": "Best Seller",
        "slug": "best-seller"
      }
    ],
    "summary": {
      "variantsUpdated": 1,
      "variantsCreated": 1,
      "variantsDeleted": 1,
      "imagesAdded": 2,
      "imagesDeleted": 1,
      "tagsUpdated": true
    },
    "updatedAt": "2025-01-15T15:00:00.000Z"
  }
}
```

**Usage Examples:**

### **Example 1: Simple Update (Product Info Only)**
```json
{
  "name": "MacBook Pro M3 16-inch",
  "idPrice": 27000000,
  "isFeatured": true
}
```

### **Example 2: Update Product + Add New Variant**
```json
{
  "name": "MacBook Pro M3 (2025)",
  "variants": [
    {
      "variantName": "Midnight 2TB",
      "sku": "MBP-M3-MD-2TB",
      "stock": 3,
      "isActive": true,
      "imageUrls": [
        "https://cdn.store.com/variants/midnight-img1.jpg",
        "https://cdn.store.com/variants/midnight-img2.jpg"
      ]
    }
  ]
}
```

### **Example 3: Update Existing Variant Stock**
```json
{
  "variants": [
    {
      "id": "var-1",
      "stock": 50
    }
  ]
}
```

### **Example 4: Delete Variant + Update Tags**
```json
{
  "variants": [
    {
      "id": "var-2",
      "_delete": true
    }
  ],
  "tagIds": ["tag-1", "tag-3", "tag-5"]
}
```

### **Example 5: Complete Update Everything**
```json
{
  "name": "MacBook Pro M3 Pro",
  "idPrice": 30000000,
  "imageUrl": "https://cdn.store.com/products/new-main.jpg",
  "isFeatured": true,
  "isPreOrder": true,
  "preOrderDays": 21,
  "variants": [
    {
      "id": "var-1",
      "variantName": "Space Gray 512GB Pro",
      "stock": 20,
      "imagesToDelete": ["img-old-1"],
      "newImageUrls": ["https://cdn.store.com/new-variant-img.jpg"]
    },
    {
      "variantName": "New Color Option",
      "sku": "MBP-M3-NC-512",
      "stock": 10,
      "isActive": true,
      "imageUrls": [
        "https://cdn.store.com/variants/new-color-1.jpg",
        "https://cdn.store.com/variants/new-color-2.jpg",
        "https://cdn.store.com/variants/new-color-3.jpg"
      ]
    }
  ],
  "tagIds": ["tag-1", "tag-2", "tag-4", "tag-6"]
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "variants[0].sku",
      "message": "SKU already exists"
    },
    {
      "field": "imageUrl",
      "message": "Invalid image URL format"
    }
  ]
}
```

**404 Not Found:**
```json
{
  "status": "error",
  "code": 404,
  "message": "Product not found"
}
```

**409 Conflict:**
```json
{
  "status": "error",
  "code": 409,
  "message": "Update failed",
  "errors": [
    {
      "field": "slug",
      "message": "Slug already used by another product"
    }
  ]
}
```

---

## 23. Soft Delete Product

> **DELETE** `/admin/products/:id`

**Authorization:** Required (Admin/Owner role)

**Description:**
Soft delete a product (set deletedAt timestamp).

**Path Parameters:**
- `id` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
DELETE /admin/products/uuid-1
```

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

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Product not found"
}
```

---

## 24. Restore Product

> **POST** `/admin/products/:id/restore`

**Authorization:** Required (Admin/Owner role)

**Description:**
Restore a soft-deleted product.

**Path Parameters:**
- `id` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Request Body:**
```json
{}
```

**Example Request:**
```http
POST /admin/products/uuid-1/restore
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product restored successfully",
  "data": {
    "id": "uuid-1",
    "name": "MacBook Pro M3",
    "deletedAt": null,
    "restoredAt": "2025-01-16T11:00:00.000Z"
  }
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Product not found or not deleted"
}
```

---

## 25. Hard Delete Product

> **DELETE** `/admin/products/:id/permanent`

**Authorization:** Required (Admin/Owner role)

**Description:**
Permanently delete a product from database.

**Path Parameters:**
- `id` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
DELETE /admin/products/uuid-1/permanent
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product permanently deleted"
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Product not found"
}
```

---

## 26. Toggle Product Active Status

> **PATCH** `/admin/products/:id/toggle-active`

**Authorization:** Required (Admin/Owner role)

**Description:**
Toggle product active/inactive status.

**Path Parameters:**
- `id` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Request Body:**
```json
{}
```

**Example Request:**
```http
PATCH /admin/products/uuid-1/toggle-active
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Product status updated",
  "data": {
    "id": "uuid-1",
    "isActive": false,
    "updatedAt": "2025-01-16T12:00:00.000Z"
  }
}
```

# 📁 Admin API - Categories

## 34. Get All Categories (Admin)

> **GET** `/admin/categories`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get all categories including inactive ones.

**Query Parameters:**
- `includeInactive` (boolean) - Include inactive categories

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/categories?includeInactive=true
```

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
      "productCount": 45,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-10T00:00:00.000Z"
    }
  ]
}
```

---

## 35. Get Category Detail (Admin)

> **GET** `/admin/categories/:id`

**Authorization:** Required (Admin/Owner role)

**Path Parameters:**
- `id` (string, required) - Category ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/categories/cat-1
```

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
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-10T00:00:00.000Z"
  }
}
```

---

## 36. Create Category

> **POST** `/admin/categories`

**Authorization:** Required (Admin/Owner role)

**Description:**
Create a new category.

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "name": "Electronics",
  "slug": "electronics"
}
```

**Validation:**
- `name` (required, min 2, max 100)
- `slug` (required, unique, lowercase, alphanumeric with hyphens)

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

**Error (400):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "slug",
      "message": "Slug already exists"
    }
  ]
}
```

---

## 37. Update Category

> **PATCH** `/admin/categories/:id`

**Authorization:** Required (Admin/Owner role)

**Path Parameters:**
- `id` (string, required) - Category ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "name": "Consumer Electronics",
  "slug": "consumer-electronics"
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
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## 38. Delete Category

> **DELETE** `/admin/categories/:id`

**Authorization:** Required (Admin/Owner role)

**Description:**
Delete a category. Products in this category will have categoryId set to null.

**Path Parameters:**
- `id` (string, required) - Category ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
DELETE /admin/categories/cat-1
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Category deleted successfully"
}
```

**Error (400):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Cannot delete category with active products. Please reassign products first."
}
```

---

## 39. Toggle Category Active Status

> **PATCH** `/admin/categories/:id/toggle-active`

**Authorization:** Required (Admin/Owner role)

**Description:**
Toggle category active/inactive status.

**Path Parameters:**
- `id` (string, required) - Category ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Request Body:**
```json
{}
```

**Example Request:**
```http
PATCH /admin/categories/cat-1/toggle-active
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Category status updated",
  "data": {
    "id": "cat-1",
    "isActive": false,
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

# 🏷️ Admin API - Tags

## 40. Get All Tags (Admin)

> **GET** `/admin/tags`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get all tags including inactive ones.

**Query Parameters:**
- `includeInactive` (boolean) - Include inactive tags

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/tags?includeInactive=true
```

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
      "productCount": 25,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 41. Get Tag Detail (Admin)

> **GET** `/admin/tags/:id`

**Authorization:** Required (Admin/Owner role)

**Path Parameters:**
- `id` (string, required) - Tag ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/tags/tag-1
```

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
    "productCount": 25,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

## 42. Create Tag

> **POST** `/admin/tags`

**Authorization:** Required (Admin/Owner role)

**Description:**
Create a new tag.

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "name": "Trending",
  "slug": "trending"
}
```

**Validation:**
- `name` (required, unique, min 2, max 50)
- `slug` (required, unique, lowercase, alphanumeric with hyphens)

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

**Error (400):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "slug",
      "message": "Slug already exists"
    }
  ]
}
```

---

## 43. Update Tag

> **PATCH** `/admin/tags/:id`

**Authorization:** Required (Admin/Owner role)

**Path Parameters:**
- `id` (string, required) - Tag ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "name": "Hot Trending",
  "slug": "hot-trending"
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
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## 44. Delete Tag

> **DELETE** `/admin/tags/:id`

**Authorization:** Required (Admin/Owner role)

**Description:**
Delete a tag and remove all product associations.

**Path Parameters:**
- `id` (string, required) - Tag ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
DELETE /admin/tags/tag-1
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Tag deleted successfully"
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Tag not found"
}
```

---

## 45. Toggle Tag Active Status

> **PATCH** `/admin/tags/:id/toggle-active`

**Authorization:** Required (Admin/Owner role)

**Description:**
Toggle tag active/inactive status.

**Path Parameters:**
- `id` (string, required) - Tag ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Request Body:**
```json
{}
```

**Example Request:**
```http
PATCH /admin/tags/tag-1/toggle-active
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Tag status updated",
  "data": {
    "id": "tag-1",
    "isActive": false,
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## 46. Add Tag to Product

> **POST** `/admin/products/:productId/tags`

**Authorization:** Required (Admin/Owner role)

**Description:**
Add one or multiple tags to a product.

**Path Parameters:**
- `productId` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "tagIds": ["tag-1", "tag-2", "tag-3"]
}
```

**Validation:**
- `tagIds` (required, array of valid tag IDs)

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Tags added to product successfully",
  "data": {
    "productId": "uuid-1",
    "addedTags": [
      {
        "id": "tag-1",
        "name": "Trending",
        "slug": "trending"
      },
      {
        "id": "tag-2",
        "name": "Premium",
        "slug": "premium"
      },
      {
        "id": "tag-3",
        "name": "Best Seller",
        "slug": "best-seller"
      }
    ]
  }
}
```

**Error (400):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "tagIds",
      "message": "Invalid tag IDs provided"
    }
  ]
}
```

---

## 47. Remove Tag from Product

> **DELETE** `/admin/products/:productId/tags/:tagId`

**Authorization:** Required (Admin/Owner role)

**Description:**
Remove a tag from a product.

**Path Parameters:**
- `productId` (string, required) - Product ID
- `tagId` (string, required) - Tag ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
DELETE /admin/products/uuid-1/tags/tag-1
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Tag removed from product successfully"
}
```

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Tag or product not found"
}
```

---

# 🎁 Admin API - Promotions

## 48. Get All Promotions (Admin)

> **GET** `/admin/promotions`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get all promotions including inactive ones.

**Query Parameters:**
- `includeInactive` (boolean) - Include inactive promotions
- `includeExpired` (boolean) - Include expired promotions

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/promotions?includeInactive=true&includeExpired=true
```

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
      "isActive": true,
      "productCount": 20,
      "createdAt": "2024-12-15T00:00:00.000Z"
    }
  ]
}
```

---

## 49. Get Promotion Detail (Admin)

> **GET** `/admin/promotions/:id`

**Authorization:** Required (Admin/Owner role)

**Path Parameters:**
- `id` (string, required) - Promotion ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/promotions/promo-1
```

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

## 50. Create Promotion

> **POST** `/admin/promotions`

**Authorization:** Required (Admin/Owner role)

**Description:**
Create a new promotion.

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

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

**Error (400):**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "endDate",
      "message": "End date must be after start date"
    }
  ]
}
```

---

## 51. Update Promotion

> **PATCH** `/admin/promotions/:id`

**Authorization:** Required (Admin/Owner role)

**Path Parameters:**
- `id` (string, required) - Promotion ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "name": "New Year Mega Sale",
  "discount": 0.20,
  "endDate": "2025-02-15T23:59:59.000Z"
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
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

## 52. Delete Promotion

> **DELETE** `/admin/promotions/:id`

**Authorization:** Required (Admin/Owner role)

**Description:**
Delete a promotion. Products will have promotionId set to null.

**Path Parameters:**
- `id` (string, required) - Promotion ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
DELETE /admin/promotions/promo-1
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Promotion deleted successfully"
}
```

---

## 53. Toggle Promotion Active Status

> **PATCH** `/admin/promotions/:id/toggle-active`

**Authorization:** Required (Admin/Owner role)

**Description:**
Toggle promotion active/inactive status.

**Path Parameters:**
- `id` (string, required) - Promotion ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Request Body:**
```json
{}
```

**Example Request:**
```http
PATCH /admin/promotions/promo-1/toggle-active
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Promotion status updated",
  "data": {
    "id": "promo-1",
    "isActive": false,
    "updatedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

---

## 54. Assign Product to Promotion

> **POST** `/admin/promotions/:id/products/:productId`

**Authorization:** Required (Admin/Owner role)

**Description:**
Assign a product to a promotion.

**Path Parameters:**
- `id` (string, required) - Promotion ID
- `productId` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Request Body:**
```json
{}
```

**Example Request:**
```http
POST /admin/promotions/promo-1/products/uuid-1
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

## 55. Remove Product from Promotion

> **DELETE** `/admin/promotions/:id/products/:productId`

**Authorization:** Required (Admin/Owner role)

**Description:**
Remove a product from a promotion.

**Path Parameters:**
- `id` (string, required) - Promotion ID
- `productId` (string, required) - Product ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
DELETE /admin/promotions/promo-1/products/uuid-1
```

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

## 56. Get All Reviews (Admin)

> **GET** `/admin/reviews`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get all reviews with filtering options.

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `productId` (string) - Filter by product
- `rating` (integer) - Filter by rating (1-5)
- `sortBy` (string) - Sort by: `createdAt`, `rating`
- `order` (string) - `asc`, `desc`

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/reviews?page=1&limit=20&rating=5&sortBy=createdAt&order=desc
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
        "https://cdn.store.com/reviews/img1.jpg"
      ],
      "createdAt": "2025-01-15T14:30:00.000Z"
    }
  ]
}
```

---

## 57. Get Review Detail (Admin)

> **GET** `/admin/reviews/:id`

**Authorization:** Required (Admin/Owner role)

**Path Parameters:**
- `id` (string, required) - Review ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/reviews/rev-1
```

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
      "https://cdn.store.com/reviews/img1.jpg"
    ],
    "createdAt": "2025-01-15T14:30:00.000Z",
    "updatedAt": "2025-01-15T14:30:00.000Z"
  }
}
```

---

## 58. Delete Review (Admin)

> **DELETE** `/admin/reviews/:id`

**Authorization:** Required (Admin/Owner role)

**Description:**
Delete a review (moderation/spam removal).

**Path Parameters:**
- `id` (string, required) - Review ID

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
DELETE /admin/reviews/rev-1
```

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Review deleted successfully"
}
```

---

## 59. Get Reviews by Product (Admin)

> **GET** `/admin/products/:productId/reviews`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get all reviews for a specific product.

**Path Parameters:**
- `productId` (string, required) - Product ID

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `rating` (integer) - Filter by rating (1-5)
- `sortBy` (string) - Sort by: `createdAt`, `rating` (default: `createdAt`)
- `order` (string) - Order: `asc`, `desc` (default: `desc`)

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/products/uuid-1/reviews?page=1&limit=10&rating=5&sortBy=createdAt&order=desc
```

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
      "comment": "Excellent product! The M3 chip is incredibly fast and battery life is amazing. Highly recommended for professionals.",
      "images": [
        "https://cdn.store.com/reviews/rev-1-img-1.jpg",
        "https://cdn.store.com/reviews/rev-1-img-2.jpg"
      ],
      "createdAt": "2025-01-15T14:30:00.000Z",
      "updatedAt": "2025-01-15T14:30:00.000Z"
    },
    {
      "id": "rev-2",
      "userId": "user-2",
      "user": {
        "id": "user-2",
        "username": "janesmith",
        "email": "jane@example.com",
        "firstName": "Jane",
        "lastName": "Smith",
        "profileImage": null
      },
      "productId": "uuid-1",
      "rating": 5,
      "comment": "Best laptop I've ever owned. Worth every penny!",
      "images": [],
      "createdAt": "2025-01-14T10:20:00.000Z",
      "updatedAt": "2025-01-14T10:20:00.000Z"
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

**Error (404):**
```json
{
  "status": "error",
  "code": 404,
  "message": "Product not found"
}
```

---

# 📊 Admin API - Statistics & Reports

## 60. Get Product Statistics

> **GET** `/admin/products/:id/statistics`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get detailed statistics for a product.

**Path Parameters:**
- `id` (string, required) - Product ID

**Query Parameters:**
- `days` (integer, default: 30) - Statistics for last N days

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/products/uuid-1/statistics?days=30
```

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

## 61. Export Products

> **GET** `/admin/products/export`

**Authorization:** Required (Admin/Owner role)

**Description:**
Export products to CSV/Excel.

**Query Parameters:**
- `format` (string) - `csv` or `xlsx` (default: csv)
- Other filter params (same as Get All Products)

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/products/export?format=csv&categorySlug=electronics
```

**Response (200 OK):**
Returns a downloadable file with:
- `Content-Type: text/csv` for CSV format
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for XLSX format
- `Content-Disposition: attachment; filename="products_export_2025-01-16.csv"`

---

## 62. Get Dashboard Summary

> **GET** `/admin/dashboard/summary`

**Authorization:** Required (Admin/Owner role)

**Description:**
Get summary statistics for admin dashboard.

**Query Parameters:**
- `period` (string) - `today`, `week`, `month`, `year` (default: month)

**Request Headers:**
```json
{
  "Authorization": "Bearer <admin_access_token>"
}
```

**Example Request:**
```http
GET /admin/dashboard/summary?period=month
```

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

---

# 🔍 Search & Filter

## 63. Advanced Product Search

> **GET** `/products/search`

**Description:**
Advanced product search with multiple filters.

**Query Parameters:**
- `q` (string) - Search query
- `categoryId` (string) - Filter by category
- `tags` (string) - Comma-separated tag slugs
- `minPrice` (integer) - Minimum price
- `maxPrice` (integer) - Maximum price
- `rating` (integer) - Minimum rating (1-5)
- `inStock` (boolean) - Only show in-stock products
- `isFeatured` (boolean) - Filter featured products
- `isPreOrder` (boolean) - Filter pre-order products
- `sortBy` (string) - Sort field
- `order` (string) - Sort order
- `page` (integer) - Page number
- `limit` (integer) - Items per page

**Example Request:**
```http
GET /products/search?q=macbook&tags=trending,premium&minPrice=20000000&maxPrice=30000000&rating=4&inStock=true&sortBy=avgRating&order=desc
```

**Response (200 OK):**
Same format as Get All Products

---

**Version:** 1.0.0  
**Last Updated:** January 16, 2025