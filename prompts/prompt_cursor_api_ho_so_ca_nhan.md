# Nhiệm vụ
Hãy xây dựng module **Hồ sơ cá nhân** cho backend **AdonisJS v6 + Lucid + PostgreSQL** trong hệ thống quản lý đề tài khoa học và chuyển đổi số.

## Bối cảnh dự án
- Dự án backend đang dùng:
  - AdonisJS v6
  - Lucid ORM
  - PostgreSQL
  - VineJS validator
- Kiến trúc hiện tại đang theo hướng:
  - `app/controllers`
  - `app/models`
  - `app/services`
  - `app/validators`
  - `database/migrations`
  - `database/seeders`
  - `start/routes.ts`
- Hệ thống đã có:
  - `users`
  - `departments`
  - module IAM cơ bản
  - endpoint `/api/auth/me`
- `users` đã tồn tại, **không tạo lại bảng users**.

## Mục tiêu
Xây dựng module **Hồ sơ cá nhân** để quản lý thông tin nhân sự nền của cán bộ/giảng viên phục vụ hệ thống đề tài.

## Phạm vi rất quan trọng
Module này là **Hồ sơ cá nhân / hồ sơ nhân sự nền**, **không phải Hồ sơ khoa học**.

### Chỉ quản lý dữ liệu nhân sự cơ bản và dữ liệu tổ chức cần thiết
### Không nhét các phần sau vào module này ở phase hiện tại:
- publications
- research projects
- research interests
- awards khoa học
- CV khoa học công khai
- dashboard nghiên cứu

Những phần đó thuộc module **Hồ sơ khoa học** hoặc các module nghiên cứu khác.

---

# Mô hình dữ liệu đề xuất

## 1. Bảng chính
Tạo bảng mới:
- `personal_profiles`

## 2. Quan hệ
- `users` 1 - 1 `personal_profiles`
- `departments` 1 - n `personal_profiles` (qua `department_id` nếu cần)

## 3. Quy tắc
- Mỗi user tối đa có 1 hồ sơ cá nhân
- Hồ sơ cá nhân gắn với `user_id`
- Có thể đồng bộ một số field từ `users`, nhưng module này là nơi lưu thông tin hồ sơ đầy đủ hơn

---

# Phạm vi field cần hỗ trợ
Hãy xây dựng module với bộ field **gọn, thực dụng, phù hợp phase đầu**, không ôm toàn bộ HRM quá nặng.

## Nhóm 1. Thông tin định danh cơ bản
- `user_id` (unique, required)
- `staff_code` — mã cán bộ/viên chức, nullable
- `full_name`
- `gender` — `MALE`, `FEMALE`, `OTHER`, nullable
- `date_of_birth`, nullable
- `place_of_birth`, nullable

## Nhóm 2. Thông tin liên hệ
- `phone`, nullable
- `personal_email`, nullable
- `work_email`, nullable
- `address`, nullable

## Nhóm 3. Thông tin tổ chức
- `department_id`, nullable
- `position_title`, nullable
- `employment_type`, nullable

## Nhóm 4. Thông tin chuyên môn nền
- `academic_degree`, nullable
- `academic_title`, nullable
- `specialization`, nullable
- `professional_qualification`, nullable

## Nhóm 5. Giấy tờ cơ bản
- `identity_number`, nullable
- `identity_issue_date`, nullable
- `identity_issue_place`, nullable

## Nhóm 6. Trạng thái và ghi chú
- `status` — `ACTIVE`, `INACTIVE`, default `ACTIVE`
- `note`, nullable

## Nhóm 7. Audit fields
- `created_at`
- `updated_at`

---

# Những field chưa cần làm ở phase này
Không thêm vào migration / form / API ở bước này:
- BHXH chi tiết
- tình trạng hôn nhân
- thông tin đảng/đoàn
- ngạch lương, bậc lương, hệ số lương
- lịch sử công tác dài hạn
- quá trình đào tạo chi tiết nhiều dòng
- thông tin người thân
- thông tin bảo hiểm mở rộng

Nếu source có nhu cầu sau này thì để phase sau.

---

# Yêu cầu migration
Tạo migration cho bảng `personal_profiles` với cấu trúc hợp lý.

## Cấu trúc tối thiểu
- `id` bigserial primary key
- `user_id` bigint not null, unique, foreign key -> `users.id`
- `staff_code` varchar, nullable
- `full_name` varchar, not null
- `gender` varchar, nullable
- `date_of_birth` date, nullable
- `place_of_birth` varchar, nullable
- `phone` varchar, nullable
- `personal_email` varchar, nullable
- `work_email` varchar, nullable
- `address` text, nullable
- `department_id` bigint, nullable, foreign key -> `departments.id`
- `position_title` varchar, nullable
- `employment_type` varchar, nullable
- `academic_degree` varchar, nullable
- `academic_title` varchar, nullable
- `specialization` varchar, nullable
- `professional_qualification` varchar, nullable
- `identity_number` varchar, nullable
- `identity_issue_date` date, nullable
- `identity_issue_place` varchar, nullable
- `status` varchar, default `ACTIVE`
- `note` text, nullable
- `created_at`
- `updated_at`

## Index nên có
- `user_id`
- `staff_code`
- `department_id`
- `status`
- `full_name`

---

# Model
Tạo model:
- `app/models/personal_profile.ts`

## Yêu cầu
- dùng decorator của Lucid
- map đúng field
- có relation:
  - `belongsTo(() => User)`
  - `belongsTo(() => Department)` nếu model department đã có
- type rõ ràng

---

# Validators
Tạo các validator bằng VineJS:
- `create_personal_profile_validator.ts`
- `update_personal_profile_validator.ts`
- `update_personal_profile_status_validator.ts`

## Rule validate
- `user_id` bắt buộc khi create
- `user_id` unique trong `personal_profiles`
- `full_name` bắt buộc
- `gender` nếu có chỉ nhận `MALE`, `FEMALE`, `OTHER`
- `status` chỉ nhận `ACTIVE`, `INACTIVE`
- `department_id` nếu có thì phải hợp lệ
- `personal_email` và `work_email` nếu có thì validate email format

---

# Service
Tạo service:
- `app/services/personal_profile_service.ts`

## Service cần có các hàm
- `paginate(filters)`
- `findById(id)`
- `findByUserId(userId)`
- `create(payload)`
- `update(id, payload)`
- `updateStatus(id, status)`

## Logic cần xử lý
- search theo `full_name`, `staff_code`, `phone`, `email`
- filter theo `department_id`, `status`
- preload `user` và `department` cơ bản khi cần
- đảm bảo 1 user chỉ có 1 hồ sơ cá nhân
- nếu `department_id` có truyền lên thì check tồn tại
- throw lỗi rõ ràng nếu không tìm thấy

---

# Controller
Tạo controller admin cho module này.

## Tên file gợi ý
- `app/controllers/admin/personal_profiles_controller.ts`

## Các API cần hỗ trợ
### 1. GET `/admin/personal-profiles`
Danh sách có phân trang + search + filter

### Query params
- `page`
- `perPage`
- `keyword`
- `departmentId`
- `status`
- `sortBy`
- `order`

### 2. GET `/admin/personal-profiles/:id`
Chi tiết 1 hồ sơ cá nhân

### 3. GET `/admin/personal-profiles/user/:userId`
Lấy hồ sơ cá nhân theo `userId`

### 4. POST `/admin/personal-profiles`
Tạo hồ sơ cá nhân

### 5. PUT `/admin/personal-profiles/:id`
Cập nhật hồ sơ cá nhân

### 6. PATCH `/admin/personal-profiles/:id/status`
Đổi trạng thái hồ sơ cá nhân

## Yêu cầu controller
- controller mỏng
- validate request bằng VineJS
- gọi service xử lý
- response JSON rõ ràng, thống nhất

---

# Response format
Giữ format response phù hợp convention hiện tại của dự án. Nếu source đang dùng wrapper dạng:

```json
{
  "success": true,
  "data": ...,
  "message": "..."
}
```

thì hãy bám theo convention đó.

## Response list mong muốn
```json
{
  "success": true,
  "message": "Personal profiles fetched successfully",
  "data": [
    {
      "id": 1,
      "userId": 10,
      "staffCode": "GV001",
      "fullName": "Nguyễn Văn A",
      "gender": "MALE",
      "dateOfBirth": "1988-01-01",
      "phone": "0900000000",
      "personalEmail": "a@gmail.com",
      "workEmail": "a@university.edu.vn",
      "departmentId": 5,
      "department": {
        "id": 5,
        "name": "Khoa Toán"
      },
      "positionTitle": "Giảng viên",
      "academicDegree": "Tiến sĩ",
      "academicTitle": null,
      "status": "ACTIVE",
      "updatedAt": "..."
    }
  ],
  "meta": {
    "total": 1,
    "perPage": 10,
    "currentPage": 1,
    "lastPage": 1
  }
}
```

---

# Permission / access gợi ý
Nếu dự án IAM đã có thì tích hợp luôn theo hướng:
- `personal_profile.view`
- `personal_profile.create`
- `personal_profile.update`
- `personal_profile.change_status`

Nếu phase hiện tại chưa nối middleware permission đầy đủ thì ít nhất route phải nằm trong admin auth group để sau này gắn permission dễ dàng.

---

# Seed dữ liệu
Không cần seed quá nhiều.
Có thể:
- không seed nếu chưa cần
- hoặc seed 1-2 bản ghi mẫu nếu source hiện tại đang có convention seeder cho module mới

---

# Lưu ý về đồng bộ với users
`users` đã tồn tại, nên:
- không tạo lại bảng users
- không tách auth sang bảng khác
- nếu `users` đã có `full_name`, `email`, `phone`, `department_id` thì vẫn giữ nguyên
- `personal_profiles` là lớp hồ sơ mở rộng

## Có thể làm nhẹ một rule đồng bộ
- khi tạo `personal_profile`, nếu cần thì đọc `users.full_name` làm giá trị mặc định
- nhưng không bắt buộc phải auto-sync hai chiều ở phase này

---

# Yêu cầu coding style
- bám sát style source hiện tại
- không over-engineering
- không thêm feature ngoài phạm vi
- không làm module scientific profile ở prompt này
- code rõ ràng, dễ maintain

---

# Yêu cầu đầu ra
Hãy thực hiện toàn bộ thay đổi cần thiết và trả về:

1. Danh sách file mới / file đã sửa
2. Giải thích ngắn gọn thay đổi
3. Nội dung code đầy đủ cho từng file quan trọng
4. Nếu cần sửa routes, đưa đúng phần code cần chèn
5. Nếu cần chạy lệnh, liệt kê cuối cùng:
   - migration command
   - seeder command (nếu có)

Hãy code hoàn chỉnh, nhất quán, chạy được.
