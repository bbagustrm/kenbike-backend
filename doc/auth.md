****# 🔐 Auth & User Management API

---

| Role | Deskripsi | Akses Utama |
|------|------------|--------------|
| `USER` | Pelanggan biasa | Registrasi, login, transaksi pribadi |
| `ADMIN` | Pengelola sistem | Manajemen produk, user, transaksi |
| `OWNER` | Pemilik usaha | Analitik & laporan keuangan |

---

## 1. Register User

> POST /auth/register

**Deskripsi:**
Registrasi akun baru untuk pelanggan (USER).  
Admin & Owner ditambahkan langsung dari dashboard atau seed awal database.

**Request Body:**
```json
{
  "first_name": "Bagus",
  "last_name": "Atmojo",
  "username": "bagustrm",
  "email": "bagus@email.com",
  "phone_number": "+628123456789",
  "password": "password123",
  "address": "Jl. Kenangan No. 10, Jakarta"
}
```

**Response (201)**
```json
{
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "email": "bagus@email.com",
    "role": "USER"
  }
}
```

**Error (400/409)**
```json
{
  "error": "Email already registered"
}
```

## 2. Login (Email & Password)

> POST /auth/login

**Deskripsi:**
Login dengan email dan password untuk semua role (USER, ADMIN, OWNER).

**Request Body:**
```json
{
  "email": "admin@store.com",
  "password": "admin123",
}
```

**Response (200)**
```json
{
  "message": "Login successful",
  "access_token": "jwt_access_token",
  "refresh_token": "jwt_refresh_token",
  "user": {
    "id": "uuid",
    "email": "admin@store.com",
    "role": "ADMIN"
  }
}
```

**Error (401)**
```json
{
  "error": "Invalid email or password"
}
```

## 3. Login dengan Google OAuth

> GET /auth/google

Redirect ke halaman login google

> Callback: GET /auth/google/callback

Menerima data dari Google dan menghasilkan JWT token.

**Response (200)**
```json
{
  "message": "Google login successful",
  "access_token": "jwt_access_token",
  "refresh_token": "jwt_refresh_token",
  "user": {
    "email": "bagus@gmail.com",
    "first_name": "Bagus",
    "profile_image": "https://lh3.googleusercontent.com/..."
  }
}
```

**Catatan:**
Catatan: Login Google hanya untuk USER, bukan ADMIN atau OWNER.

# 4. Refresh Token

> POST /auth/refresh

**Deskripsi:**
Mendapatkan access token baru menggunakan refresh token yang valid

**Request Body:**
```json
{
  "refresh_token": "jwt_refresh_token"
}
```

**Response (200)**
```json
{
  "access_token": "new_jwt_access_token"
}
```

**Error (401)**
```json
{
  "error": "Invalid or expired refresh token"
}
```

# 5.Logout

> POST /auth/logout

> Authorization: Bearer <access_token>

**Deskripsi:**
Menghapus sesi pengguna

**Response (200)**
```json
{
  "message": "Logged out successfully" 
}
```


# 6. Get Current User (Profile)

> GET /auth/me

> Authorization: Bearer <access_token>

**Deskripsi:**
Mengambil data user yang sedang login (berdasarkan JWT).

**Response (200)**
```json
{
  "id": "uuid",
  "first_name": "Bagus",
  "last_name": "Atmojo",
  "username": "bagus_dev",
  "email": "bagus@mail.com",
  "phone_number": "081234567890",
  "address": "Jl. Merdeka No. 1",
  "profile_image": "https://cdn.site.com/profile/bagus.jpg",
  "role": "USER",
}
```


# 7. Update Profile (User Only)

> PATCH /auth/profile

> Authorization: Bearer <access_token>

**Description:**
Hanya bisa mengupdate field: profile_image, phone_number, dan address.
Tidak bisa mengubah first_name, last_name, atau username.

**Request Body**
```json
{
  "phone_number": "081222333444"
}
```

**Response (200)**
```json
{
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid",
    "phone_number": "081222333444"
  }
}
```

# 8. Update Password

> PATCH /auth/password

> Authorization: Bearer <access_token>

**Request Body**
```json
{
  "old_password": "oldpassword123",
  "new_password": "newpassword456"
}
```

**Response (200)**
```json
{
  "message": "Password updated successfully"
}
```


# 9. Update Address

> PATCH /auth/address

> Authorization: Bearer <access_token>

**Request Body**
```json
{
  "address": "Jl. Baru No. 2, Jakarta"
}
```

**Response (200)**
```json
{
  "message": "Address updated successfully",
  "data": {
    "address": "Jl. Baru No. 2, Jakarta"
  }
}
```

# 10. Delete Profile Images

> DELETE /auth/profile-image

> Authorization: Bearer <access_token>

**Response (200)**
```json
{
  "message": "Profile image deleted successfully"
}
```

# 11. Get All Users (Admin/Owner Only)

> GET /admin/users

> Authorization: Bearer <access_token>

**Description:**
Access hanya untuk role ADMIN, OWNER

**Response (200)**
```json
{
  "meta": {
    "total": 37,
    "page": 2,
    "limit": 5,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": true
  },
  "data": [
    {
      "id": "user-uuid-001",
      "email": "user1@mail.com",
      "username": "user1",
      "role": "USER",
      "profile_image": "https://cdn.site.com/profiles/u1.jpg",
      "phone_number": "081234567890",
      "address": "Jl. Sudirman No. 1"
    },
    {
      "id": "user-uuid-002",
      "email": "user2@mail.com",
      "username": "user2",
      "role": "USER",
      "profile_image": null,
      "phone_number": "082134567891",
      "address": "Jl. Merdeka No. 2"
    }
  ]
}
```

# 12. Get User Detail (Admin/Owner Only)

> GET /admin/users/:id

> Authorization: Bearer <access_token>

**Description:**
Access hanya untuk role ADMIN, OWNER

**Response (200)**
```json
{
  "id": "7d17b5e2-ef13-4b9e-b318-5f55b21f53b9",
  "first_name": "Bagus",
  "last_name": "Atmojo",
  "username": "bagus_dev",
  "email": "bagus@mail.com",
  "phone_number": "081234567890",
  "address": "Jl. Merdeka No. 1",
  "profile_image": "https://cdn.site.com/profiles/bagus.jpg",
  "role": "USER",
  "is_verified": true,
  "provider": "email",
  "created_at": "2025-09-01T08:30:00.000Z",
  "updated_at": "2025-10-01T10:20:00.000Z"
}

```****