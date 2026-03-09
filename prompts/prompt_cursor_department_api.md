# Nhiệm vụ
Hãy xây dựng đầy đủ API backend cho chức năng **quản lý department** trong dự án **AdonisJS v6 + Lucid + PostgreSQL**.

## Bối cảnh dự án
- Đây là hệ thống quản lý đề tài khoa học và chuyển đổi số.
- Dự án backend hiện đang dùng:
  - AdonisJS v6
  - Lucid ORM
  - PostgreSQL
  - VineJS validator
- Kiến trúc đang theo hướng:
  - `app/controllers`
  - `app/models`
  - `app/services`
  - `app/validators`
  - `database/migrations`
  - `database/seeders`
  - `start/routes.ts`

## Mục tiêu chức năng
Xây dựng module **Department Management** để quản lý danh mục đơn vị trong trường.

## Lưu ý quan trọng
- **Chưa cần quản lý phân cấp cha con**
- **Không cần `parent_id`**
- **Không cần lịch sử đổi mã**
- Chỉ quản lý danh mục đơn vị phẳng
- Nhưng **phải có `type`** để phân loại đơn vị

---

# Yêu cầu nghiệp vụ

## 1. Department cần quản lý các thông tin sau
- `id`
- `code`: mã đơn vị, duy nhất
- `name`: tên đơn vị
- `short_name`: tên ngắn, nullable
- `type`: loại đơn vị
- `display_order`: số thứ tự hiển thị
- `status`: trạng thái hoạt động
- `note`: ghi chú, nullable
- `created_at`
- `updated_at`

## 2. Các loại `type` cần hỗ trợ
Dùng string hoặc enum với các giá trị:
- `UNIVERSITY`
- `BOARD`
- `OFFICE`
- `FACULTY`
- `CENTER`
- `COUNCIL`
- `OTHER`

## 3. Trạng thái `status`
- `ACTIVE`
- `INACTIVE`

## 4. Rule validate
- `code` là bắt buộc, không trùng
- `name` là bắt buộc
- `type` là bắt buộc, chỉ được nằm trong danh sách cho phép
- `display_order` mặc định là 0
- `status` mặc định là `ACTIVE`

---

# Các API cần xây dựng

## 1. GET /admin/departments
Danh sách department có phân trang, filter, search.

### Query params hỗ trợ
- `page`
- `perPage`
- `keyword`: tìm theo `code` hoặc `name`
- `type`
- `status`
- `sortBy`
- `order`

### Yêu cầu
- Trả dữ liệu phân trang
- Sắp xếp mặc định theo:
  - `display_order ASC`
  - `created_at DESC`

---

## 2. GET /admin/departments/:id
Lấy chi tiết 1 department

---

## 3. POST /admin/departments
Tạo mới department

---

## 4. PUT /admin/departments/:id
Cập nhật department

---

## 5. PATCH /admin/departments/:id/status
Cập nhật riêng trạng thái `ACTIVE/INACTIVE`

### Body mẫu
```json
{
  "status": "ACTIVE"
}
```

---

# Yêu cầu kỹ thuật

## 1. Tạo migration
Tạo bảng `departments` với cấu trúc:

- `id` bigserial primary key
- `code` varchar, unique, not null
- `name` varchar, not null
- `short_name` varchar, nullable
- `type` varchar, not null
- `display_order` integer, default 0
- `status` varchar, default `ACTIVE`
- `note` text, nullable
- `created_at`
- `updated_at`

### Thêm index cho:
- `code`
- `name`
- `type`
- `status`
- `display_order`

---

## 2. Tạo model
Tạo model `Department` trong `app/models/department.ts`

### Yêu cầu
- dùng decorator của Lucid
- map đúng các cột
- có kiểu dữ liệu rõ ràng

---

## 3. Tạo validators
Tạo validator riêng bằng VineJS:
- `create_department_validator.ts`
- `update_department_validator.ts`
- `update_department_status_validator.ts`

### Yêu cầu
- tái sử dụng constant cho enum nếu hợp lý
- code sạch, dễ đọc

---

## 4. Tạo service
Tạo `app/services/department_service.ts`

### Tách business logic khỏi controller
Service cần có các hàm:
- `paginate(filters)`
- `findById(id)`
- `create(payload)`
- `update(id, payload)`
- `updateStatus(id, status)`

### Yêu cầu trong service
- xử lý query filter/search
- throw lỗi phù hợp nếu không tìm thấy
- đảm bảo `code` unique khi create/update
- code clean, không nhét logic nặng vào controller

---

## 5. Tạo controller
Tạo controller quản trị:
`app/controllers/admin/departments_controller.ts`

### Các method:
- `index`
- `show`
- `store`
- `update`
- `changeStatus`

### Yêu cầu
- controller mỏng
- validate request bằng validator
- gọi service để xử lý
- response JSON rõ ràng, thống nhất

---

## 6. Tạo route
Thêm route vào `start/routes.ts`

### Yêu cầu route dạng:
- `GET /admin/departments`
- `GET /admin/departments/:id`
- `POST /admin/departments`
- `PUT /admin/departments/:id`
- `PATCH /admin/departments/:id/status`

### Lưu ý
- Đặt trong group `/admin`
- Nếu project hiện tại đã có middleware auth thì hãy gắn cùng convention hiện có của dự án

---

# Format response yêu cầu

## Response list
```json
{
  "message": "Departments fetched successfully",
  "data": [
    {
      "id": 1,
      "code": "PTO",
      "name": "Phòng Tổ chức",
      "short_name": "P. Tổ chức",
      "type": "OFFICE",
      "display_order": 1,
      "status": "ACTIVE",
      "note": null,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "meta": {
    "total": 10,
    "perPage": 10,
    "currentPage": 1,
    "lastPage": 1
  }
}
```

## Response detail
```json
{
  "message": "Department fetched successfully",
  "data": {
    "id": 1,
    "code": "PTO",
    "name": "Phòng Tổ chức",
    "short_name": "P. Tổ chức",
    "type": "OFFICE",
    "display_order": 1,
    "status": "ACTIVE",
    "note": null,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Response create/update/status
```json
{
  "message": "Department created successfully",
  "data": {
    "id": 1,
    "code": "PTO",
    "name": "Phòng Tổ chức",
    "short_name": "P. Tổ chức",
    "type": "OFFICE",
    "display_order": 1,
    "status": "ACTIVE",
    "note": null,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

# Error handling
Hãy xử lý các case sau:
- không tìm thấy department -> trả lỗi 404
- `code` bị trùng -> trả lỗi 422 hoặc 400 phù hợp theo convention dự án
- validate fail -> theo chuẩn validator hiện tại của Adonis/Vine
- id không hợp lệ -> xử lý an toàn

---

# Seed mẫu
Tạo thêm seeder hoặc ít nhất chuẩn bị dữ liệu mẫu cho các department sau:
- Trường Đại học Sư phạm — `UNIVERSITY`
- Ban Giám hiệu — `BOARD`
- Phòng Tổ chức — `OFFICE`
- Phòng Đào tạo — `OFFICE`
- Phòng Kế hoạch - Tài chính — `OFFICE`
- Khoa Toán — `FACULTY`
- Khoa Hóa — `FACULTY`
- Trung tâm Tin học — `CENTER`
- Hội đồng trường — `COUNCIL`

Không cần import file excel, chỉ seed vài bản ghi mẫu.

---

# Coding style yêu cầu
- Bám sát style của source hiện tại
- Không phá kiến trúc cũ
- Ưu tiên code rõ ràng, dễ maintain
- Không over-engineering
- Không thêm các tính năng ngoài phạm vi yêu cầu
- Không thêm `parent_id`
- Không thêm soft delete nếu dự án hiện tại chưa dùng
- Không thêm permission phức tạp ở bước này

---

# Yêu cầu đầu ra
Hãy thực hiện toàn bộ thay đổi cần thiết và trả về:
1. Danh sách file mới / file đã sửa
2. Nội dung code đầy đủ cho từng file
3. Nếu cần sửa file route, hãy đưa chính xác phần code cần chèn
4. Nếu cần chạy lệnh, liệt kê cuối cùng:
   - migration command
   - seeder command

Hãy code hoàn chỉnh, nhất quán, chạy được.
