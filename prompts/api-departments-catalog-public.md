# SPEC API — Danh mục đơn vị (Departments Catalog) — Dùng chung / Public Read

## 1. Mục tiêu

Tách **đọc danh mục đơn vị** (dropdown, filter, hiển thị) khỏi **quản trị CRUD** (Admin).

- **Catalog (read):** API dùng chung, nhiều module gọi — **không** yêu cầu role Admin / permission `department.view`.
- **Admin (write):** Giữ `POST/PUT/PATCH/DELETE` tại `/api/admin/departments` — cần quyền quản trị.

Bảng dữ liệu gốc: **`departments`** (đã có).

---

## 2. Phạm vi sử dụng trên Frontend (hiện tại & dự kiến)

| Module | Field / UI | Cần từ catalog |
|--------|------------|----------------|
| Hồ sơ khoa học | `faculty` — Khoa/phòng ban | Có — loại Khoa/Phòng/Ban… |
| Hồ sơ nhân sự | `departmentId` | Có — toàn bộ ACTIVE |
| IAM User | `department_id` | Có |
| Staffs, báo cáo, filter | dropdown đơn vị | Có |
| Admin → Quản lý đơn vị | CRUD bảng | Dùng API admin (không đổi) |

**Cơ quan công tác** (trường ĐHĐN) trên hồ sơ khoa học: vẫn dùng list `UDN_AFFILIATION_UNITS` (constants) — **không** lấy từ bảng `departments` trừ khi sau này BE đồng bộ thêm.

---

## 3. Phân quyền

### 3.1. Catalog (API mới)

- **Yêu cầu:** User **đã đăng nhập** (Bearer token hợp lệ).
- **Không yêu cầu:** `department.view`, Admin, PHONG_KH, v.v.
- **Không trả:** đơn vị `INACTIVE` (mặc định), trừ khi gọi có `status=INACTIVE` và user có quyền admin (tùy chọn phase 2).

### 3.2. Admin CRUD (giữ nguyên)

- `GET/POST/PUT/PATCH /api/admin/departments` — cần `department.view` / `department.create` / …

---

## 4. API đề xuất

### 4.1. Danh sách catalog (chính)

```
GET /api/departments
```

**Mô tả:** Lấy danh sách đơn vị **ACTIVE** phục vụ select/filter trên toàn hệ thống.

#### Query parameters

| Param | Kiểu | Bắt buộc | Mặc định | Mô tả |
|-------|------|----------|----------|--------|
| `status` | string | Không | `ACTIVE` | `ACTIVE` \| `INACTIVE` — catalog thường chỉ `ACTIVE` |
| `type` | string | Không | — | Lọc 1 loại: `UNIVERSITY`, `FACULTY`, `OFFICE`, `CENTER`, `BOARD`, `COUNCIL`, `OTHER` |
| `scope` | string | Không | `all` | Xem mục 5 — preset lọc theo ngữ cảnh |
| `keyword` | string | Không | — | Tìm theo `code`, `name`, `short_name` |
| `page` | number | Không | 1 | Phân trang (list đầy đủ) |
| `perPage` | number | Không | 500 | Dropdown nên cho phép tới 500–1000 |
| `sortBy` | string | Không | `display_order` | `display_order` \| `name` \| `code` |
| `order` | string | Không | `asc` | `asc` \| `desc` |

#### Response 200

```json
{
  "success": true,
  "message": "Departments fetched successfully",
  "data": [
    {
      "id": 12,
      "code": "K_LH",
      "name": "Khoa Lý - Hóa",
      "short_name": "Khoa Lý - Hóa",
      "type": "FACULTY",
      "display_order": 10,
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "total": 45,
    "perPage": 500,
    "currentPage": 1,
    "lastPage": 1
  }
}
```

**Lưu ý:** Field trả về **snake_case** như bảng hiện tại (`short_name`, `display_order`) để khớp Admin API.

**Không bắt buộc** trả `note`, `created_at`, `updated_at` trên catalog (giảm payload). Nếu trả cũng được.

#### Lỗi

| HTTP | Trường hợp |
|------|------------|
| 401 | Chưa đăng nhập |
| 422 | Query không hợp lệ |

---

### 4.2. Dropdown gọn (khuyến nghị)

```
GET /api/departments/options
```

**Mô tả:** Chỉ trả field cần cho `<Select>` — gọi nhanh, cache được.

#### Query

Giống `GET /api/departments` (`scope`, `type`, `keyword`, `status`).

#### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "code": "K_LH",
      "name": "Khoa Lý - Hóa",
      "short_name": "Khoa Lý - Hóa",
      "type": "FACULTY"
    }
  ]
}
```

**Không phân trang** — trả tối đa toàn bộ ACTIVE (hoặc giới hạn 1000, BE ghi trong meta nếu cần).

---

### 4.3. Chi tiết một đơn vị (tùy chọn)

```
GET /api/departments/:id
```

- Chỉ đơn vị `ACTIVE` (hoặc 404).
- Dùng khi cần hiển thị chi tiết, ít dùng hơn list.

---

## 5. Query `scope` — preset lọc (quan trọng cho FE)

| `scope` | Ý nghĩa | Lọc `type` |
|---------|---------|------------|
| `all` | Mọi đơn vị ACTIVE | Không lọc type |
| `khoa_phong_ban` | Khoa / Phòng / Ban… (hồ sơ KH: `faculty`) | `FACULTY`, `OFFICE`, `CENTER`, `BOARD`, `COUNCIL`, `OTHER` — **loại trừ** `UNIVERSITY` |
| `truong` | Cấp trường (nếu sau này thay constants) | Chỉ `UNIVERSITY` |

**Ví dụ hồ sơ khoa học:**

```
GET /api/departments/options?scope=khoa_phong_ban&status=ACTIVE
```

---

## 6. Enum `type` (đồng bộ FE)

| Giá trị | Nhãn VN |
|---------|---------|
| `UNIVERSITY` | Trường |
| `BOARD` | Ban |
| `OFFICE` | Phòng |
| `FACULTY` | Khoa |
| `CENTER` | Trung tâm |
| `COUNCIL` | Hội đồng |
| `OTHER` | Khác |

---

## 7. Quy tắc nghiệp vụ BE

1. Mặc định chỉ trả `status = ACTIVE`.
2. Sắp xếp mặc định: `display_order ASC`, `name ASC` (locale Việt).
3. `keyword` tìm không phân biệt hoa thường trên `code`, `name`, `short_name`.
4. Catalog **read-only** — không POST/PUT/DELETE trên `/api/departments`.
5. Dữ liệu đồng nhất với bảng Admin: sửa ở Admin → dropdown các module thấy ngay (không cache lâu phía BE, hoặc cache TTL ngắn).

---

## 8. Tách route Admin vs Catalog

| Thao tác | Route | Quyền |
|----------|-------|--------|
| List/CRUD quản trị | `/api/admin/departments` | `department.*` |
| List catalog (app) | `/api/departments` | Đăng nhập |
| Options dropdown | `/api/departments/options` | Đăng nhập |

**Không** bắt buộc deprecate `GET /api/admin/departments` ngay — Admin page có thể giữ. Các module nghiệp vụ **chuyển dần** sang `/api/departments`.

---

## 9. FE sau khi BE xong (tham chiếu)

```ts
// src/services/api/departments.ts (dự kiến)
export async function queryDepartmentCatalog(params?: {
  scope?: 'all' | 'khoa_phong_ban' | 'truong';
  type?: DepartmentType;
  keyword?: string;
  status?: 'ACTIVE';
  perPage?: number;
}) {
  return get<PaginatedResponse<Department>>('/api/departments', params);
}

export async function getDepartmentCatalogOptions(params?: {
  scope?: 'all' | 'khoa_phong_ban' | 'truong';
  keyword?: string;
}) {
  return get<ApiResponse<DepartmentOptionRow[]>>('/api/departments/options', params);
}
```

**Hồ sơ khoa học:** `loadProfileKhoaPhongBanOptions()` → `getDepartmentCatalogOptions({ scope: 'khoa_phong_ban' })` → map `name` vào `faculty`.

---

## 10. Checklist Backend

- [ ] `GET /api/departments` — auth login, mặc định ACTIVE, phân trang + meta
- [ ] `GET /api/departments/options` — payload gọn
- [ ] Query `scope=khoa_phong_ban` loại trừ UNIVERSITY
- [ ] Không yêu cầu permission `department.view`
- [ ] Document OpenAPI / Postman collection
- [ ] (Tùy chọn) `GET /api/departments/:id`

---

## 11. Ví dụ curl

```bash
# Khoa/phòng ban cho hồ sơ khoa học
curl -H "Authorization: Bearer <token>" \
  "https://<host>/api/departments/options?scope=khoa_phong_ban&status=ACTIVE"

# Toàn bộ đơn vị (nhân sự, filter)
curl -H "Authorization: Bearer <token>" \
  "https://<host>/api/departments/options?status=ACTIVE&perPage=1000"
```

---

**Phiên bản:** 1.0  
**Ngày:** 2026-05-21  
**Liên quan:** `specs/prompt_cursor_frontend_department.md`, module Hồ sơ khoa học (`profile.faculty`)
