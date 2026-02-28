# Prompt 01: Authentication & Users Module

Tôi cần bạn tạo API Authentication và Users cho hệ thống "Quản lý Khoa học & Công nghệ" bằng AdonisJS + PostgreSQL.

## 1. Database Schema

### Bảng `users`
```sql
- id: bigint, PK, auto increment
- email: varchar(255), unique, not null
- password: varchar(255), not null (bcrypt hash)
- full_name: varchar(255), not null
- role: enum('NCV', 'CNDT', 'TRUONG_DON_VI', 'PHONG_KH', 'HOI_DONG', 'LANH_DAO', 'ADMIN'), default 'NCV'
- role_label: varchar(100) - Nhãn hiển thị role (VD: "Nhà khoa học", "Phòng Khoa học")
- avatar_url: text, nullable
- phone: varchar(20), nullable
- unit: varchar(255), nullable - Đơn vị công tác
- is_active: boolean, default true
- created_at: timestamp
- updated_at: timestamp
```

### Bảng `api_tokens` (AdonisJS Auth)
- Sử dụng API Token của AdonisJS (@adonisjs/auth)

## 2. Các Role trong hệ thống
```typescript
type UserRole =
  | 'NCV'           // Nhà khoa học / Giảng viên
  | 'CNDT'          // Chủ nhiệm đề tài
  | 'TRUONG_DON_VI' // Trưởng đơn vị
  | 'PHONG_KH'      // Phòng Khoa học
  | 'HOI_DONG'      // Hội đồng
  | 'LANH_DAO'      // Lãnh đạo
  | 'ADMIN';        // Admin
```

## 3. API Endpoints

### POST /api/auth/login
Request:
```json
{
  "email": "string",
  "password": "string"
}
```
Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@university.edu.vn",
      "fullName": "Admin",
      "role": "ADMIN",
      "roleLabel": "Quản trị viên",
      "avatarUrl": null,
      "unit": "Phòng KH"
    },
    "token": {
      "type": "bearer",
      "token": "xxx",
      "expiresAt": "2024-03-20T10:00:00Z"
    }
  }
}
```

### POST /api/auth/logout
Header: `Authorization: Bearer {token}`
Response: 
```json
{ "success": true, "message": "Đăng xuất thành công" }
```

### GET /api/auth/me
Header: `Authorization: Bearer {token}`
Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "admin@university.edu.vn",
    "fullName": "Admin",
    "role": "ADMIN",
    "roleLabel": "Quản trị viên",
    "avatarUrl": null,
    "unit": "Phòng KH"
  }
}
```

### GET /api/users (ADMIN only)
Query params: `page`, `perPage`, `keyword`, `role`, `unit`, `isActive`
Response:
```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 100, "currentPage": 1, "perPage": 10, "lastPage": 10 }
}
```

### GET /api/users/:id (ADMIN only)

### POST /api/users (ADMIN only)
Request:
```json
{
  "email": "string",
  "password": "string",
  "fullName": "string",
  "role": "NCV",
  "roleLabel": "Nhà khoa học",
  "unit": "string",
  "phone": "string"
}
```

### PUT /api/users/:id (ADMIN only)
Request: (các field cần update)
```json
{
  "fullName": "string",
  "role": "NCV",
  "roleLabel": "Nhà khoa học",
  "unit": "string",
  "phone": "string",
  "isActive": true
}
```

### DELETE /api/users/:id (ADMIN only)
- Soft delete: set isActive = false

## 4. Middleware

### Auth Middleware
- Verify Bearer token từ header `Authorization`
- Attach user vào request context

### Role Middleware
- Check quyền theo role
- Sử dụng: `Route.middleware(['auth', 'role:ADMIN,PHONG_KH'])`

## 5. Validators

### LoginValidator
- email: required, email format
- password: required, min 6

### CreateUserValidator
- email: required, email format, unique
- password: required, min 6
- fullName: required
- role: required, enum

### UpdateUserValidator
- email: optional, email format, unique (exclude current)
- fullName: optional
- role: optional, enum

## 6. Seed Data

Tạo các user mặc định:
```typescript
const users = [
  { email: 'admin@university.edu.vn', password: 'admin123', fullName: 'Admin', role: 'ADMIN', roleLabel: 'Quản trị viên', unit: 'Phòng CNTT' },
  { email: 'phongkh@university.edu.vn', password: 'password', fullName: 'Phòng Khoa học', role: 'PHONG_KH', roleLabel: 'Phòng Khoa học', unit: 'Phòng KH' },
  { email: 'hoidong@university.edu.vn', password: 'password', fullName: 'Hội đồng KH', role: 'HOI_DONG', roleLabel: 'Hội đồng', unit: 'Hội đồng KH' },
  { email: 'lanhdao@university.edu.vn', password: 'password', fullName: 'Lãnh đạo', role: 'LANH_DAO', roleLabel: 'Lãnh đạo', unit: 'Ban Giám hiệu' },
  { email: 'truongkhoa@university.edu.vn', password: 'password', fullName: 'Trưởng Khoa CNTT', role: 'TRUONG_DON_VI', roleLabel: 'Trưởng đơn vị', unit: 'Khoa CNTT' },
  { email: 'ncv@university.edu.vn', password: 'password', fullName: 'Nguyễn Văn A', role: 'NCV', roleLabel: 'Nhà khoa học', unit: 'Khoa CNTT' },
  { email: 'cndt@university.edu.vn', password: 'password', fullName: 'Trần Văn B', role: 'CNDT', roleLabel: 'Chủ nhiệm đề tài', unit: 'Khoa Kinh tế' },
]
```

## 7. Yêu cầu

Hãy tạo đầy đủ:
1. Migration file cho bảng users
2. Model User với relationships
3. AuthController (login, logout, me)
4. UsersController (CRUD)
5. Routes file
6. Auth Middleware
7. Role Middleware  
8. Validators
9. Seeder

## 8. Sau khi tạo xong, chạy:

```bash
# Chạy migration
node ace migration:run

# Chạy seeder
node ace db:seed
```
