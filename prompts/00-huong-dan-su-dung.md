# Hướng dẫn sử dụng các Prompt API

## Quy tắc quan trọng - Naming Convention

### 1. API Response phải dùng camelCase
Tất cả field trong response JSON phải dùng **camelCase** để khớp với frontend:
- ✅ `createdAt`, `updatedAt`, `ownerId`, `ownerName`
- ❌ `created_at`, `updated_at`, `owner_id`, `owner_name`

AdonisJS có thể configure `serializeAs` trong Model để convert tự động.

### 2. Boolean fields
- Dùng `read` (KHÔNG phải `isRead`)
- Dùng `unitApproved` (KHÔNG phải `is_unit_approved`)

### 3. Array fields dùng JSONB
- VD: `suitableLevels`, `keywords`, `coAuthors`, `subResearchAreas`

## Thứ tự thực hiện

Gửi các prompt theo thứ tự từ 01 đến 08 cho Cursor AI để implement API backend.

| File | Module | Mô tả |
|------|--------|-------|
| 01-auth-users.md | Authentication & Users | Login, logout, token, user CRUD |
| 02-admin-catalogs.md | Admin & Catalogs | Cấu hình hệ thống, audit log, danh mục |
| 03-notifications.md | Notifications | Thông báo |
| 04-scientific-profile.md | Scientific Profile | Hồ sơ khoa học, publications |
| 05-ideas.md | Ideas | Ngân hàng ý tưởng |
| 06-ideas-council.md | Ideas Council | Hội đồng chấm điểm ý tưởng |
| 07-project-proposals.md | Project Proposals | Đăng ký đề xuất đề tài |
| 08-home-dashboard.md | Home/Dashboard | Tổng hợp dashboard theo role |

## Sau mỗi prompt

Sau khi Cursor AI tạo xong code cho mỗi module, chạy lệnh:

```bash
# Chạy migration
node ace migration:run

# Chạy seeder (nếu có)
node ace db:seed
```

## Kiểm tra API

```bash
# Chạy server dev
node ace serve --watch

# Server sẽ chạy tại http://localhost:3333
```

## Test API với curl hoặc Postman

```bash
# Login
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@university.edu.vn","password":"admin123"}'

# Sử dụng token nhận được cho các request khác
curl http://localhost:3333/api/auth/me \
  -H "Authorization: Bearer {token}"
```
