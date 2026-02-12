# ⭐ Review & Rating API Documentation

**Version:** 1.0.0  
**Last Updated:** January 16, 2025  
**Base URL:** `http://localhost:3000/api/v1`

---

## **Overview**

Review system yang memungkinkan user memberikan rating dan komentar untuk produk setelah order DELIVERED atau COMPLETED.

**Key Features:**
- Only verified purchasers can review
- One review per product per user
- 14-day window after delivery
- Admin moderation (auto-approve)
- Image upload support (up to 5 images)

**Business Rules:**
- User can only review if order status is DELIVERED or COMPLETED
- Review window: 14 days after delivery
- Cannot edit/delete review after submission
- Star rating: 1-5 stars

---

# **User Endpoints**

## 1. Check If User Can Review Product

> **GET** `/reviews/can-review/:productId`

**Description:**  
Check if current user can review a product (has purchased and within review window).

**Authorization:** Required (USER)

**Path Parameters:**
- `productId`: Product UUID

**Response (200 OK) - Can Review:**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "canReview": true,
    "orderId": "order-uuid-1",
    "orderNumber": "ORD-20250116-0001",
    "deliveredAt": "2025-01-18T10:00:00.000Z",
    "reviewDeadline": "2025-02-01T10:00:00.000Z",
    "daysRemaining": 12
  }
}
```

**Response (200 OK) - Cannot Review:**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "canReview": false,
    "reason": "No delivered order found for this product",
    "alternatives": [
      "Purchase this product first",
      "Wait for your order to be delivered"
    ]
  }
}
```

**Response (200 OK) - Already Reviewed:**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "canReview": false,
    "reason": "You have already reviewed this product",
    "existingReview": {
      "id": "review-uuid-1",
      "rating": 5,
      "createdAt": "2025-01-20T14:00:00.000Z"
    }
  }
}
```

---

## 2. Create Review

> **POST** `/reviews`

**Description:**  
Create a product review with rating, comment, and optional images.

**Authorization:** Required (USER, verified purchaser)

**Request Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
```
productId: "product-uuid-1"
orderId: "order-uuid-1"
rating: 5
comment: "Excellent product! Highly recommended."
images[0]: <file>
images[1]: <file>
```

**Validation Rules:**
- `productId`: Required, valid UUID
- `orderId`: Required, valid UUID, order must be DELIVERED/COMPLETED
- `rating`: Required, integer, min: 1, max: 5
- `comment`: Optional, string, max: 1000 characters
- `images`: Optional, max 5 files, each max 2MB, format: JPG/PNG/WEBP

**Response (201 Created):**
```json
{
  "status": "success",
  "code": 201,
  "message": "Review created successfully",
  "data": {
    "id": "review-uuid-1",
    "userId": "user-uuid-1",
    "productId": "product-uuid-1",
    "rating": 5,
    "comment": "Excellent product! Highly recommended.",
    "images": [
      {
        "id": "review-img-uuid-1",
        "imageUrl": "https://cdn.store.com/reviews/img1.jpg"
      },
      {
        "id": "review-img-uuid-2",
        "imageUrl": "https://cdn.store.com/reviews/img2.jpg"
      }
    ],
    "createdAt": "2025-01-20T14:00:00.000Z"
  }
}
```

**Error (403 Forbidden) - Not Eligible:**
```json
{
  "status": "error",
  "code": 403,
  "message": "You are not eligible to review this product",
  "errors": [
    {
      "field": "review",
      "message": "Order must be delivered before you can review"
    }
  ]
}
```

**Error (400 Bad Request) - Already Reviewed:**
```json
{
  "status": "error",
  "code": 400,
  "message": "You have already reviewed this product"
}
```

**Error (400 Bad Request) - Review Window Expired:**
```json
{
  "status": "error",
  "code": 400,
  "message": "Review window has expired",
  "errors": [
    {
      "field": "review",
      "message": "Reviews must be submitted within 14 days of delivery"
    }
  ]
}
```

---

## 3. Get Product Reviews

> **GET** `/products/:productId/reviews`

**Description:**  
Get all reviews for a product with pagination.

**Authorization:** Not required (Public)

**Path Parameters:**
- `productId`: Product UUID or slug

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 10, max: 50)
- `rating` (integer, optional) - Filter by rating (1-5)
- `withImages` (boolean, optional) - Only reviews with images
- `sortBy` (string, default: createdAt) - Sort by: createdAt, rating
- `order` (string, default: desc) - Sort order: asc, desc

**Example Request:**
```
GET /products/macbook-pro-m3/reviews?page=1&limit=10&rating=5&sortBy=createdAt&order=desc
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
    "hasPrevPage": false
  },
  "data": {
    "product": {
      "id": "product-uuid-1",
      "name": "MacBook Pro M3",
      "slug": "macbook-pro-m3",
      "avgRating": 4.8,
      "totalReviews": 45
    },
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
    },
    "reviews": [
      {
        "id": "review-uuid-1",
        "user": {
          "id": "user-uuid-1",
          "firstName": "John",
          "lastName": "Doe",
          "profileImage": "https://cdn.store.com/users/john.jpg"
        },
        "rating": 5,
        "comment": "Excellent product! The M3 chip is incredibly fast.",
        "images": [
          {
            "id": "review-img-uuid-1",
            "imageUrl": "https://cdn.store.com/reviews/img1.jpg"
          }
        ],
        "isVerifiedPurchase": true,
        "createdAt": "2025-01-20T14:00:00.000Z"
      }
    ]
  }
}
```

---

## 4. Get My Reviews

> **GET** `/reviews/my-reviews`

**Description:**  
Get all reviews submitted by current user.

**Authorization:** Required (USER)

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 10)

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  },
  "data": [
    {
      "id": "review-uuid-1",
      "product": {
        "id": "product-uuid-1",
        "name": "MacBook Pro M3",
        "slug": "macbook-pro-m3",
        "imageUrl": "https://cdn.store.com/products/macbook.jpg"
      },
      "rating": 5,
      "comment": "Excellent product!",
      "images": [
        {
          "id": "review-img-uuid-1",
          "imageUrl": "https://cdn.store.com/reviews/img1.jpg"
        }
      ],
      "createdAt": "2025-01-20T14:00:00.000Z"
    }
  ]
}
```

---

# **Admin Endpoints**

## 5. Get All Reviews (Admin)

> **GET** `/admin/reviews`

**Description:**  
Get all reviews with advanced filtering for admin.

**Authorization:** Required (ADMIN, OWNER)

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `productId` (string, optional)
- `userId` (string, optional)
- `rating` (integer, optional)
- `search` (string, optional) - Search by comment
- `sortBy` (string, default: createdAt)
- `order` (string, default: desc)

**Response:** Same format as public product reviews but includes user email and order info.

---

## 6. Delete Review (Admin)

> **DELETE** `/admin/reviews/:id`

**Description:**  
Delete a review (for moderation/spam removal).

**Authorization:** Required (ADMIN, OWNER)

**Path Parameters:**
- `id`: Review UUID

**Response (200 OK):**
```json
{
  "status": "success",
  "code": 200,
  "message": "Review deleted successfully"
}
```

---

# **Business Logic**

## **Review Eligibility Validation**

```typescript
async canUserReviewProduct(userId: string, productId: string) {
  // 1. Find delivered/completed order containing this product
  const order = await prisma.order.findFirst({
    where: {
      userId,
      status: { in: ['DELIVERED', 'COMPLETED'] },
      items: {
        some: { productId }
      }
    },
    orderBy: { deliveredAt: 'desc' }
  });

  if (!order) {
    return { canReview: false, reason: 'No delivered order found' };
  }

  // 2. Check if already reviewed
  const existingReview = await prisma.review.findFirst({
    where: { userId, productId }
  });

  if (existingReview) {
    return { canReview: false, reason: 'Already reviewed' };
  }

  // 3. Check 14-day window
  const deliveredAt = order.deliveredAt;
  const now = new Date();
  const daysSinceDelivery = Math.floor(
    (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceDelivery > 14) {
    return { canReview: false, reason: 'Review window expired' };
  }

  return {
    canReview: true,
    orderId: order.id,
    deliveredAt: order.deliveredAt,
    daysRemaining: 14 - daysSinceDelivery
  };
}
```

---

## **Update Product Average Rating**

```typescript
async updateProductRating(productId: string) {
  // Calculate average rating
  const result = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });

  const avgRating = result._avg.rating || 0;
  const totalReviews = result._count;

  // Update product
  await prisma.product.update({
    where: { id: productId },
    data: {
      avgRating: parseFloat(avgRating.toFixed(1)),
      // Optional: store total reviews count
    },
  });
}
```

---

## **Email Notification - Review Reminder**

**Trigger:** 3 days after delivery

```typescript
// Cron job runs daily
async sendReviewReminders() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Find orders delivered 3 days ago
  const orders = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: {
        gte: new Date(threeDaysAgo.setHours(0, 0, 0, 0)),
        lt: new Date(threeDaysAgo.setHours(23, 59, 59, 999)),
      },
    },
    include: {
      user: true,
      items: {
        include: { product: true }
      }
    }
  });

  for (const order of orders) {
    // Check which products haven't been reviewed
    const unreviewed = [];
    
    for (const item of order.items) {
      const hasReview = await prisma.review.findFirst({
        where: {
          userId: order.userId,
          productId: item.productId
        }
      });
      
      if (!hasReview) {
        unreviewed.push(item.product);
      }
    }

    if (unreviewed.length > 0) {
      await mailService.sendReviewReminder(order.user, order, unreviewed);
    }
  }
}
```

---

## **Frontend Integration Example**

```typescript
// Check if user can review
const { data } = await fetch(`/api/v1/reviews/can-review/${productId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

if (data.canReview) {
  // Show review form
  showReviewForm({
    daysRemaining: data.daysRemaining,
    orderId: data.orderId
  });
} else {
  // Show reason why can't review
  showMessage(data.reason);
}

// Submit review
const formData = new FormData();
formData.append('productId', productId);
formData.append('orderId', orderId);
formData.append('rating', rating);
formData.append('comment', comment);

// Add images
images.forEach((image, index) => {
  formData.append(`images[${index}]`, image);
});

const response = await fetch('/api/v1/reviews', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

---

## **Database Schema Reference**

```prisma
model Review {
  id        String        @id @default(uuid())
  userId    String
  productId String
  rating    Int           @default(0) // 1-5
  comment   String?       @db.Text
  images    ReviewImage[]
  
  user    User    @relation(fields: [userId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, productId]) // One review per product per user
  @@index([productId])
  @@index([rating])
}

model ReviewImage {
  id       String @id @default(uuid())
  reviewId String
  imageUrl String

  review Review @relation(fields: [reviewId], references: [id], onDelete: Cascade)

  @@index([reviewId])
}
```

---

## **Testing Scenarios**

1. **User tries to review without purchase** → 403 Forbidden
2. **User reviews within 14 days** → 201 Created
3. **User tries to review twice** → 400 Already reviewed
4. **User tries to review after 14 days** → 400 Window expired
5. **User uploads 6 images** → 400 Max 5 images
6. **User uploads 3MB image** → 400 Max 2MB per image
7. **Admin deletes spam review** → 200 Success
8. **Product avg rating updates** → Rating recalculated

---

## **Production Considerations**

- [ ] Implement review flagging system (spam/abuse)
- [ ] Add "helpful" vote system
- [ ] Implement review response (seller reply)
- [ ] Add image moderation (manual/AI)
- [ ] Set up review analytics dashboard
- [ ] Monitor review submission rate
- [ ] A/B test review reminder timing
- [ ] Implement review incentive program (optional)

