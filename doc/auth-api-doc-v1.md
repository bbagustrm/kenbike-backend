# 🔐 Auth & User Management API

---

## **Role & Access Control**

| Role | Deskripsi | Akses Utama |
|------|------------|--------------|
| `USER` | Pelanggan biasa | Registrasi, login, transaksi pribadi |
| `ADMIN` | Pengelola sistem | Manajemen produk, user, transaksi |
| `OWNER` | Pemilik usaha | Analitik & laporan keuangan |

---

## **Password Requirements**
- Minimal 8 karakter
- Harus mengandung minimal 1 huruf besar (A-Z)
- Harus mengandung minimal 1 huruf kecil (a-z)
- Harus mengandung minimal 1 angka (0-9)
- Harus mengandung minimal 1 karakter spesial (!@#$%^&*)

---

## **Profile Image Requirements**
- Format: JPG, JPEG, PNG, WEBP
- Maksimal ukuran: 2MB
- Resolusi disarankan: 400x400px (rasio 1:1)

---

## **Token Information**
- **Access Token**: Berlaku 15 menit
- **Refresh Token**: Berlaku 7 hari
- **Token Type**: Bearer JWT
- **Logout Mechanism**: Blacklist token (disimpan di Redis/Database sampai expired)

---

## **Standard Error Response Format**

```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email format is invalid"
    }
  ]
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid credentials atau token expired)
- `403` - Forbidden (tidak punya akses)
- `404` - Not Found
- `409` - Conflict (data sudah ada, misal: email/username duplicate)
- `422` - Unprocessable Entity (business logic error)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

# **Authentication Endpoints**

## 1. Register User

> **POST** `/auth/register`

**Deskripsi:**
Registrasi akun baru untuk pelanggan (USER). Admin & Owner ditambahkan langsung dari dashboard atau seed awal database.

**Request Body:**
```json
{
  "first_name": "Bagus",
  "last_name": "Atmojo",
  "username": "bagustrm",
  "email": "bagus@email.com",
  "phone_number": "+628123456789",
  "country" : "Indonesia",
  "password": "SecurePass123!",
  "address": "Jl. Kenangan No. 10, Jakarta"
}
```

**Validation Rules:**
- `first_name`: Required, min 2 karakter, max 50 karakter
- `last_name`: Required, min 2 karakter, max 50 karakter
- `username`: Required, unique, alphanumeric + underscore, min 3 karakter, max 30 karakter
- `email`: Required, unique, valid email format
- `phone_number`: Optional, valid international phone format
- `country`: Optional, max 50 karakter
- `password`: Required, must meet password requirements
- `address`: Optional, max 255 karakter

**Response (201 Created)**
```json
{
  "status": "success",
  "code": 201,
  "message": "User registered successfully. Please check your email to verify your account.",
  "data": {
    "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
    "email": "bagus@email.com",
    "username": "bagustrm",
    "role": "USER",
    "is_verified": false
  }
}
```

**Error Responses:**

**400 Bad Request - Validation Error**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "password",
      "message": "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character"
    },
    {
      "field": "email",
      "message": "Email format is invalid"
    }
  ]
}
```

**409 Conflict - Duplicate Data**
```json
{
  "status": "error",
  "code": 409,
  "message": "Registration failed",
  "errors": [
    {
      "field": "email",
      "message": "Email already registered"
    }
  ]
}
```

---

## 2. Verify Email

> **POST** `/auth/verify-email`

**Deskripsi:**
Verifikasi email menggunakan token yang dikirim ke email setelah registrasi.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Email verified successfully. You can now login."
}
```

**Error (400 Bad Request)**
```json
{
  "status": "error",
  "code": 400,
  "message": "Invalid or expired verification token"
}
```

**Error (404 Not Found)**
```json
{
  "status": "error",
  "code": 404,
  "message": "User not found"
}
```

---

## 3. Resend Verification Email

> **POST** `/auth/resend-verification`

**Deskripsi:**
Mengirim ulang email verifikasi jika token sebelumnya expired atau tidak diterima.

**Request Body:**
```json
{
  "email": "bagus@email.com"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Verification email has been sent. Please check your inbox."
}
```

**Error (404 Not Found)**
```json
{
  "status": "error",
  "code": 404,
  "message": "Email not found"
}
```

**Error (422 Unprocessable Entity)**
```json
{
  "status": "error",
  "code": 422,
  "message": "Email already verified"
}
```

**Error (429 Too Many Requests)**
```json
{
  "status": "error",
  "code": 429,
  "message": "Too many requests. Please try again in 5 minutes."
}
```

---

## 4. Login (Email & Password)

> **POST** `/auth/login`

**Deskripsi:**
Login dengan email dan password untuk semua role (USER, ADMIN, OWNER).

**Request Body:**
```json
{
  "email": "admin@store.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
      "email": "admin@store.com",
      "username": "admin_store",
      "role": "ADMIN",
      "is_verified": true
    }
  }
}
```

**Error (401 Unauthorized)**
```json
{
  "status": "error",
  "code": 401,
  "message": "Invalid email or password"
}
```

**Error (403 Forbidden)**
```json
{
  "status": "error",
  "code": 403,
  "message": "Please verify your email before logging in"
}
```

**Error (429 Too Many Requests)**
```json
{
  "status": "error",
  "code": 429,
  "message": "Too many login attempts. Please try again in 15 minutes."
}
```

---

## 5. Login dengan Google OAuth

> **GET** `/auth/google`

**Deskripsi:**
Redirect ke halaman login Google OAuth.

**Response:**
Redirect ke Google OAuth consent screen.

---

> **GET** `/auth/google/callback`

**Deskripsi:**
Callback endpoint yang menerima data dari Google dan menghasilkan JWT token.

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Google login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
      "email": "bagus@gmail.com",
      "first_name": "Bagus",
      "last_name": "Atmojo",
      "profile_image": "https://lh3.googleusercontent.com/...",
      "role": "USER",
      "is_verified": true
    }
  }
}
```

**Catatan:**
- Login Google hanya untuk USER, bukan ADMIN atau OWNER
- User yang login via Google otomatis terverifikasi (is_verified: true)
- Jika email sudah terdaftar via email/password, sistem akan merge account

**Error (400 Bad Request)**
```json
{
  "status": "error",
  "code": 400,
  "message": "Google authentication failed"
}
```

---

## 6. Refresh Token

> **POST** `/auth/refresh`

**Deskripsi:**
Mendapatkan access token baru menggunakan refresh token yang valid.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

**Error (401 Unauthorized)**
```json
{
  "status": "error",
  "code": 401,
  "message": "Invalid or expired refresh token"
}
```

---

## 7. Forgot Password

> **POST** `/auth/forgot-password`

**Deskripsi:**
Mengirim email berisi link/token untuk reset password.

**Request Body:**
```json
{
  "email": "bagus@email.com"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Password reset link has been sent to your email"
}
```

**Catatan:**
- Token reset password berlaku 1 jam
- Untuk keamanan, response selalu success meski email tidak terdaftar

**Error (429 Too Many Requests)**
```json
{
  "status": "error",
  "code": 429,
  "message": "Too many requests. Please try again in 5 minutes."
}
```

---

## 8. Reset Password

> **POST** `/auth/reset-password`

**Deskripsi:**
Reset password menggunakan token yang dikirim via email.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "new_password": "NewSecurePass456!",
  "confirm_password": "NewSecurePass456!"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Password has been reset successfully. You can now login with your new password."
}
```

**Error (400 Bad Request)**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "new_password",
      "message": "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character"
    },
    {
      "field": "confirm_password",
      "message": "Passwords do not match"
    }
  ]
}
```

**Error (401 Unauthorized)**
```json
{
  "status": "error",
  "code": 401,
  "message": "Invalid or expired reset token"
}
```

---

## 9. Logout

> **POST** `/auth/logout`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Logout dan blacklist token saat ini. Token yang di-blacklist tidak bisa digunakan lagi sampai expired.

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Logged out successfully"
}
```

**Error (401 Unauthorized)**
```json
{
  "status": "error",
  "code": 401,
  "message": "Invalid or expired token"
}
```

---

# **User Profile Endpoints**

## 10. Get Current User (Profile)

> **GET** `/auth/me`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Mengambil data user yang sedang login (berdasarkan JWT).

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
    "first_name": "Bagus",
    "last_name": "Atmojo",
    "username": "bagus_dev",
    "email": "bagus@mail.com",
    "phone_number": "+628123456789",
    "country": "Indonesia",
    "address": "Jl. Merdeka No. 1",
    "profile_image": "https://cdn.site.com/profile/bagus.jpg",
    "role": "USER",
    "is_verified": true,
    "provider": "email",
    "created_at": "2025-09-01T08:30:00.000Z",
    "updated_at": "2025-10-01T10:20:00.000Z"
  }
}
```

**Error (401 Unauthorized)**
```json
{
  "status": "error",
  "code": 401,
  "message": "Invalid or expired token"
}
```

---

## 11. Update Profile

> **PATCH** `/auth/profile`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Update profile user. Field yang bisa diupdate: `profile_image`, `phone_number`, `address`.
Tidak bisa mengubah `first_name`, `last_name`, `username`, `email`, atau `role`.

**Request Body (multipart/form-data):**
```json
{
  "phone_number": "+628122333444",
  "address": "Jl. Baru No. 5, Bandung",
  "profile_image": "<file>"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Profile updated successfully",
  "data": {
    "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
    "phone_number": "+628122333444",
    "address": "Jl. Baru No. 5, Bandung",
    "profile_image": "https://cdn.site.com/profile/bagus_new.jpg",
    "updated_at": "2025-10-06T14:30:00.000Z"
  }
}
```

**Error (400 Bad Request)**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "profile_image",
      "message": "File size must not exceed 2MB"
    },
    {
      "field": "profile_image",
      "message": "Only JPG, JPEG, PNG, and WEBP formats are allowed"
    }
  ]
}
```

---

## 12. Update Password

> **PATCH** `/auth/password`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Update password user yang sedang login.

**Request Body:**
```json
{
  "old_password": "OldSecurePass123!",
  "new_password": "NewSecurePass456!",
  "confirm_password": "NewSecurePass456!"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Password updated successfully"
}
```

**Error (400 Bad Request)**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "new_password",
      "message": "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character"
    },
    {
      "field": "confirm_password",
      "message": "Passwords do not match"
    }
  ]
}
```

**Error (401 Unauthorized)**
```json
{
  "status": "error",
  "code": 401,
  "message": "Old password is incorrect"
}
```

---

## 13. Update Address

> **PATCH** `/auth/address`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Update alamat user.

**Request Body:**
```json
{
  "address": "Jl. Baru No. 2, Jakarta"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Address updated successfully",
  "data": {
    "address": "Jl. Baru No. 2, Jakarta",
    "updated_at": "2025-10-06T14:45:00.000Z"
  }
}
```

---

## 14. Delete Profile Image

> **DELETE** `/auth/profile-image`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Menghapus foto profil user (set menjadi null/default).

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "Profile image deleted successfully"
}
```

**Error (404 Not Found)**
```json
{
  "status": "error",
  "code": 404,
  "message": "No profile image to delete"
}
```

---

# **Admin/Owner - User Management Endpoints**

**Akses:** Hanya untuk role `ADMIN` dan `OWNER`

## 15. Get All Users

> **GET** `/admin/users`

**Authorization:** `Bearer <access_token>`

**Query Parameters:**
- `page` (integer, default: 1) - Halaman pagination
- `limit` (integer, default: 10, max: 100) - Jumlah data per halaman
- `role` (string, optional) - Filter by role: USER, ADMIN, OWNER
- `search` (string, optional) - Search by name, email, or username
- `is_verified` (boolean, optional) - Filter by verification status
- `sort_by` (string, default: created_at) - Sort by: created_at, email, username
- `order` (string, default: desc) - Order: asc, desc

**Example Request:**
```
GET /admin/users?page=1&limit=10&role=USER&search=bagus&sort_by=created_at&order=desc
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "meta": {
    "total": 37,
    "page": 1,
    "limit": 10,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [
    {
      "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
      "email": "user1@mail.com",
      "username": "user1",
      "first_name": "User",
      "last_name": "One",
      "role": "USER",
      "is_verified": true,
      "is_active": true,
      "profile_image": "https://cdn.site.com/profiles/u1.jpg",
      "phone_number": "+628123456789",
      "country": "Indonesia",
      "provider": "email",
      "created_at": "2025-09-01T08:30:00.000Z"
    },
    {
      "id": "8e28c6f3-fg24-5c0f-c429-6g66c32g64c0",
      "email": "user2@mail.com",
      "username": "user2",
      "first_name": "User",
      "last_name": "Two",
      "role": "USER",
      "is_verified": false,
      "is_active": true,
      "profile_image": null,
      "phone_number": "+628234567891",
      "country": "Indonesia",
      "provider": "google",
      "created_at": "2025-09-15T10:20:00.000Z"
    }
  ]
}
```

**Error (403 Forbidden)**
```json
{
  "status": "error",
  "code": 403,
  "message": "Access denied. Admin or Owner role required."
}
```

---

## 16. Get User Detail

> **GET** `/admin/users/:id`

**Authorization:** `Bearer <access_token>`

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
    "first_name": "Bagus",
    "last_name": "Atmojo",
    "username": "bagus_dev",
    "email": "bagus@mail.com",
    "phone_number": "+628123456789",
    "address": "Jl. Merdeka No. 1",
    "country": "Indonesia",
    "profile_image": "https://cdn.site.com/profiles/bagus.jpg",
    "role": "USER",
    "is_verified": true,
    "is_active": true,
    "provider": "email",
    "last_login": "2025-10-06T10:30:00.000Z",
    "created_at": "2025-09-01T08:30:00.000Z",
    "updated_at": "2025-10-01T10:20:00.000Z"
  }
}
```

**Error (404 Not Found)**
```json
{
  "status": "error",
  "code": 404,
  "message": "User not found"
}
```

---

## 18. Create User (Admin Only)

> **POST** `/admin/users`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Admin dapat membuat user baru dengan role apapun (USER, ADMIN, OWNER).

**Request Body:**
```json
{
  "first_name": "New",
  "last_name": "Admin",
  "username": "newadmin",
  "email": "newadmin@store.com",
  "phone_number": "+628123456789",
  "country": "Indonesia",
  "password": "SecurePass123!",
  "address": "Jl. Admin No. 1",
  "role": "ADMIN",
  "is_verified": true
}
```

**Response (201 Created)**
```json
{
  "status": "success",
  "code": 201,
  "message": "User created successfully",
  "data": {
    "id": "9f39d7g4-hh35-6d1g-d540-7h77d43h75d1",
    "email": "newadmin@store.com",
    "username": "newadmin",
    "role": "ADMIN",
    "is_verified": true,
    "created_at": "2025-10-06T15:00:00.000Z"
  }
}
```

**Error (403 Forbidden)**
```json
{
  "status": "error",
  "code": 403,
  "message": "Access denied. Admin role required."
}
```

---

## 19. Update User (Admin Only)

> **PATCH** `/admin/users/:id`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Admin dapat mengupdate data user termasuk first_name, last_name, username, email, phone_number, address.

**Request Body:**
```json
{
  "first_name": "Updated",
  "last_name": "Name",
  "email": "updated@email.com",
  "phone_number": "+628999888777",
  "address": "Jl. Updated No. 99"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "User updated successfully",
  "data": {
    "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
    "first_name": "Updated",
    "last_name": "Name",
    "email": "updated@email.com",
    "phone_number": "+628999888777",
    "address": "Jl. Updated No. 99",
    "updated_at": "2025-10-06T15:30:00.000Z"
  }
}
```

**Error (404 Not Found)**
```json
{
  "status": "error",
  "code": 404,
  "message": "User not found"
}
```

---

## 20. Change User Role (Admin Only)

> **PATCH** `/admin/users/:id/role`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Mengubah role user (USER ↔ ADMIN ↔ OWNER).

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "User role updated successfully",
  "data": {
    "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
    "email": "user@mail.com",
    "role": "ADMIN",
    "updated_at": "2025-10-06T16:00:00.000Z"
  }
}
```

**Error (400 Bad Request)**
```json
{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "role",
      "message": "Role must be one of: USER, ADMIN, OWNER"
    }
  ]
}
```

---

## 21. Change User Status (Admin Only)

> **PATCH** `/admin/users/:id/status`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Mengubah status aktif user (suspend/activate). User yang di-suspend tidak bisa login.

**Request Body:**
```json
{
  "is_active": false,
  "reason": "Violating terms of service"
}
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "User status updated successfully",
  "data": {
    "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
    "email": "user@mail.com",
    "is_active": false,
    "suspended_reason": "Violating terms of service",
    "suspended_at": "2025-10-06T16:30:00.000Z",
    "updated_at": "2025-10-06T16:30:00.000Z"
  }
}
```

**Catatan:**
- Ketika user di-suspend, semua token mereka di-revoke dan tidak bisa login
- Field `reason` akan disimpan untuk audit trail

---

## 22. Delete User (Admin Only)

> **DELETE** `/admin/users/:id`

**Authorization:** `Bearer <access_token>`

**Query Parameters:**
- `permanent` (boolean, default: false) - True untuk hard delete, false untuk soft delete

**Deskripsi:**
Menghapus user dari sistem.
- **Soft Delete (default)**: Data tidak benar-benar dihapus, hanya ditandai sebagai deleted (deleted_at)
- **Hard Delete**: Data benar-benar dihapus dari database

**Example Request (Soft Delete):**
```
DELETE /admin/users/7d17b5e2-ef13-4b9e-b318-5f55b21f53b9
```

**Example Request (Hard Delete):**
```
DELETE /admin/users/7d17b5e2-ef13-4b9e-b318-5f55b21f53b9?permanent=true
```

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "User deleted successfully"
}
```

**Error (403 Forbidden)**
```json
{
  "status": "error",
  "code": 403,
  "message": "Cannot delete your own account or other admin/owner accounts"
}
```

**Error (404 Not Found)**
```json
{
  "status": "error",
  "code": 404,
  "message": "User not found"
}
```

---

## 23. Force Logout User (Admin Only)

> **POST** `/admin/users/:id/force-logout`

**Authorization:** `Bearer <access_token>`

**Deskripsi:**
Memaksa logout user tertentu dari semua device dengan me-revoke semua token mereka.

**Response (200 OK)**
```json
{
  "status": "success",
  "code": 200,
  "message": "User has been logged out from all devices"
}
```
