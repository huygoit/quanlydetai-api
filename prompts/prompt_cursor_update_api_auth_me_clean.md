# Nhiệm vụ
Hãy cập nhật **API hiện có `GET /api/auth/me`** trong dự án **AdonisJS v6 + Lucid + PostgreSQL** để frontend **Ant Design Pro** có thể dùng dữ liệu thật cho access control theo permission.

## Bối cảnh dự án
- Đây là backend AdonisJS của hệ thống quản lý đề tài khoa học và chuyển đổi số
- Dự án hiện đã có endpoint:
  - `GET /api/auth/me`
- Hiện tại endpoint này trả về dạng:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "admin@university.edu.vn",
    "fullName": "Admin",
    "role": "ADMIN",
    "roleLabel": "Quản trị viên",
    "unit": "Phòng CNTT"
  }
}
```

- Backend hiện đang/đã triển khai dần module IAM phase 1:
  - `roles`
  - `permissions`
  - `role_permissions`
  - `user_role_assignments`
- Frontend cần dùng `/api/auth/me` để:
  - lấy thông tin user hiện tại
  - lấy department hiện tại
  - lấy danh sách roles
  - lấy danh sách permissions thật
  - dùng cho `getInitialState` + `src/access.ts`
  - ẩn/hiện menu, route, nút action theo permission

---

# Mục tiêu
**Không tạo endpoint mới.**
Hãy **cập nhật chính method `me()` của endpoint `GET /api/auth/me`** để response trả về dữ liệu đầy đủ cho access control, theo cấu trúc mới sạch hơn.

## Yêu cầu rất quan trọng
- **Không tạo API mới** như `/profile`, `/current-user`, `/auth/profile`
- **Chỉ cập nhật endpoint hiện có `GET /api/auth/me`**
- **Không phá flow login cũ**
- **Không tạo lại bảng `users`**
- Nếu bảng `users` đã có `department_id` thì dùng luôn
- Nếu project đã có relation `department` thì tận dụng
- Nếu permissions đang lấy gián tiếp qua roles thì hãy aggregate và flatten ở backend
- **Loại bỏ hoàn toàn các field legacy cũ khỏi response mới**:
  - không trả `role`
  - không trả `roleLabel`
  - không trả `unit`

Mục tiêu là:
- response sạch
- frontend mới chỉ dùng `roles`, `permissions`, `department`
- không duy trì field cũ nữa

---

# Response mục tiêu sau khi cập nhật
Hãy cập nhật response của `GET /api/auth/me` thành theo hướng như sau:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@university.edu.vn",
    "fullName": "Admin",
    "phone": null,
    "status": "ACTIVE",
    "departmentId": 1,
    "department": {
      "id": 1,
      "code": "IT",
      "name": "Phòng CNTT",
      "type": "OFFICE"
    },
    "roles": [
      {
        "id": 1,
        "code": "SYSTEM_ADMIN",
        "name": "Quản trị viên"
      }
    ],
    "permissions": [
      "department.view",
      "department.create",
      "department.update",
      "user.view",
      "user.create",
      "user.update",
      "user.assign_role",
      "user.reset_password",
      "role.view",
      "role.create",
      "role.update",
      "role.assign_permission",
      "permission.view"
    ]
  }
}
```

---

# Giải thích các field

## Field cần có
- `id`
- `username`
- `email`
- `fullName`
- `phone`
- `status`
- `departmentId`
- `department`
- `roles`
- `permissions`

## Không giữ field cũ
Response mới phải **không còn**:
- `role`
- `roleLabel`
- `unit`

Frontend sẽ chuyển sang dùng dữ liệu chuẩn mới:
- `roles`
- `permissions`
- `department`

---

# Yêu cầu nghiệp vụ

## 1. API này áp dụng cho mọi user
- admin cũng dùng cùng endpoint `/api/auth/me`
- user thường cũng dùng cùng endpoint `/api/auth/me`
- không tạo logic profile riêng cho admin

Khác nhau chỉ là dữ liệu:
- admin có nhiều permissions hơn
- user thường có ít permissions hơn

---

## 2. `roles`
- là danh sách role đang active của user
- mỗi item gồm:
  - `id`
  - `code`
  - `name`

Ví dụ:
```json
[
  {
    "id": 1,
    "code": "SYSTEM_ADMIN",
    "name": "Quản trị viên"
  }
]
```

---

## 3. `permissions`
- là danh sách **permission code duy nhất**
- phải là mảng `string[]`
- không trùng lặp
- được tổng hợp từ tất cả role đang active của user

Ví dụ:
```json
[
  "department.view",
  "department.create",
  "user.view",
  "role.view"
]
```

---

## 4. `department`
- nếu user có `department_id` thì trả object department cơ bản:
  - `id`
  - `code`
  - `name`
  - `type`
- nếu user chưa có department thì:
  - `departmentId: null`
  - `department: null`

---

# Yêu cầu kỹ thuật

## 1. Xác định đúng method `me()`
Hãy đọc source backend hiện tại và tìm đúng:
- route `GET /api/auth/me`
- controller method tương ứng, có thể là `me()`

### Yêu cầu
- chỉ sửa method hiện có
- không tạo route mới nếu không cần

---

## 2. Cập nhật query lấy current user
Khi thực hiện `me()`, cần lấy thêm:
- department
- user_role_assignments đang active
- role của từng assignment
- permissions của từng role

### Quan hệ dữ liệu mong muốn
- `users` -> `department`
- `users` -> `user_role_assignments`
- `user_role_assignments` -> `role`
- `role` -> `permissions` qua `role_permissions`

### Yêu cầu lọc
- chỉ lấy role assignment đang active
- nếu có `start_at`, `end_at` thì chỉ lấy role còn hiệu lực
- nếu bảng `roles` có `status` hoặc `is_active` thì chỉ lấy role active
- permission phải được gom lại theo `code` và loại bỏ trùng lặp

---

## 3. Flatten permissions ở backend
Frontend không nên phải tự duyệt sâu kiểu:
- assignment
- role
- role_permissions
- permission
- code

Hãy flatten sẵn thành:
- `roles: RoleSummary[]`
- `permissions: string[]`

---

## 4. Nếu logic dài, hãy tách service/helper
Nếu cần, tạo hoặc cập nhật service phù hợp để xử lý logic profile, ví dụ:
- `auth_profile_service.ts`
- hoặc thêm helper trong auth service hiện có

### Logic service nên làm
- lấy current user
- preload department
- preload role assignments đang active
- preload role + permissions
- build `roles`
- build `permissions`
- unique permission codes
- build response object cuối cùng

---

# Ví dụ response mong muốn

## Trường hợp admin
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@university.edu.vn",
    "fullName": "Admin",
    "phone": null,
    "status": "ACTIVE",
    "departmentId": 1,
    "department": {
      "id": 1,
      "code": "IT",
      "name": "Phòng CNTT",
      "type": "OFFICE"
    },
    "roles": [
      {
        "id": 1,
        "code": "SYSTEM_ADMIN",
        "name": "Quản trị viên"
      }
    ],
    "permissions": [
      "department.view",
      "department.create",
      "department.update",
      "user.view",
      "user.create",
      "user.update",
      "user.assign_role",
      "role.view",
      "role.create",
      "role.update",
      "role.assign_permission",
      "permission.view"
    ]
  }
}
```

## Trường hợp user thường
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "teacher01",
    "email": "teacher01@university.edu.vn",
    "fullName": "Nguyễn Văn A",
    "phone": null,
    "status": "ACTIVE",
    "departmentId": 5,
    "department": {
      "id": 5,
      "code": "MATH",
      "name": "Khoa Toán",
      "type": "FACULTY"
    },
    "roles": [
      {
        "id": 5,
        "code": "SCIENTIST",
        "name": "Nhà khoa học"
      }
    ],
    "permissions": [
      "profile.view_own",
      "profile.update_own",
      "idea.create",
      "idea.update",
      "idea.submit"
    ]
  }
}
```

## Trường hợp user chưa có department
```json
{
  "success": true,
  "data": {
    "id": 3,
    "username": "guest01",
    "email": "guest01@example.com",
    "fullName": "Guest User",
    "phone": null,
    "status": "ACTIVE",
    "departmentId": null,
    "department": null,
    "roles": [
      {
        "id": 9,
        "code": "GUEST",
        "name": "Khách"
      }
    ],
    "permissions": []
  }
}
```

---

# Không thay đổi login response nếu không cần
Nếu login hiện tại đang ổn, hãy giữ nguyên.
Frontend sau login sẽ gọi:
- `GET /api/auth/me`

để lấy access data đầy đủ.

Không cần nhét toàn bộ `roles/permissions` vào login response nếu không cần thiết.

---

# Error handling
- chưa đăng nhập -> trả 401 theo convention hiện tại
- token/session không hợp lệ -> trả 401
- không làm thay đổi auth middleware cũ
- không phá shape wrapper hiện tại nếu đang dùng:
  - `success`
  - `data`

---

# Coding style
- bám sát source hiện tại
- ưu tiên sửa `auth_controller.ts` hoặc đúng controller đang chứa `me()`
- không over-engineering
- không tạo quá nhiều abstraction thừa
- nếu cần service thì chỉ tách vừa đủ
- code rõ ràng, dễ maintain

---

# Yêu cầu đầu ra
Hãy thực hiện toàn bộ thay đổi cần thiết và trả về:

1. Danh sách file mới / file đã sửa
2. Giải thích ngắn gọn thay đổi
3. Nội dung code đầy đủ cho các file quan trọng
4. Chỉ rõ method `me()` đã được cập nhật như thế nào
5. Chỉ rõ query preload/relation/service dùng để build `roles` và `permissions`
6. Đưa ví dụ response mới của `GET /api/auth/me`

Hãy code hoàn chỉnh, nhất quán, chạy được, không phá flow cũ.
