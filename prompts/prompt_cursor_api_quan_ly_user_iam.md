# Nhiệm vụ
Hãy xây dựng **API backend quản lý User trong module Vai trò & Phân quyền (IAM)** cho dự án **AdonisJS v6 + Lucid + PostgreSQL** hiện có.

## Mục tiêu
Xây dựng API quản lý user phục vụ **quản trị tài khoản truy cập + gán đơn vị + gán vai trò**, không phải module HRM đầy đủ.

API này phải bám theo kiến trúc hiện tại của dự án:
- `app/controllers`
- `app/models`
- `app/services`
- `app/validators`
- `database/migrations`
- `start/routes.ts`

---

# Bối cảnh rất quan trọng của dự án hiện tại
Dự án **đã có bảng `users` và đã có User model / users controller cũ**.

## Yêu cầu bắt buộc
- **KHÔNG được tạo lại bảng `users`**
- **KHÔNG được drop bảng `users`**
- **KHÔNG được đổi flow auth hiện tại nếu không thật cần thiết**
- Chỉ được **alter table `users` để bổ sung field mới nếu cần**
- Ưu tiên **tái sử dụng User model hiện tại**
- Nếu cần refactor User model thì phải giữ tương thích với auth hiện tại

## Trạng thái hiện tại của bảng users / model hiện có
Hiện tại `users` đang có các field chính như sau:
- `id`
- `full_name`
- `email`
- `password`
- `role`
- `role_label`
- `avatar_url`
- `phone`
- `unit`
- `is_active`
- `created_at`
- `updated_at`

## Ý nghĩa thiết kế mới
Hệ thống phân quyền mới sẽ dùng các bảng IAM riêng:
- `roles`
- `permissions`
- `role_permissions`
- `user_role_assignments`

Do đó:
- field `users.role` và `users.role_label` hiện tại là **legacy / backward compatibility**
- về lâu dài quyền sẽ lấy từ bảng `user_role_assignments`
- nhưng ở phase này cần triển khai API user sao cho **không phá code cũ**

---

# Phạm vi chức năng lần này
Chỉ xây dựng **API quản lý user trong IAM**, bao gồm:

1. Danh sách user
2. Chi tiết user
3. Tạo user
4. Cập nhật user
5. Đổi trạng thái active/inactive
6. Reset mật khẩu
7. Gán role cho user
8. Xem danh sách role đang được gán cho user

Không làm frontend ở bước này.
Không làm HRM.
Không làm soft delete phức tạp.
Không làm parent department.

---

# Mục tiêu nghiệp vụ
Module User trong IAM phải quản lý:
- tài khoản truy cập
- thông tin cơ bản
- department của user
- trạng thái tài khoản
- role được gán cho user

## User form về mặt nghiệp vụ cần có
- `full_name`
- `email`
- `phone`
- `department_id` (mới)
- `status` hoặc `is_active`
- `note` (nếu cần thêm)
- `password` / `confirm_password` khi tạo mới
- danh sách `role_ids` để gán role

## Lưu ý quan trọng
- Hệ thống hiện tại đang auth theo `email`
- Không bắt buộc thêm `username` nếu chưa cần
- Nếu không thật sự cần, **không thêm username**
- Đơn vị cũ `unit` là text legacy; hệ thống mới nên dùng `department_id`
- Có thể giữ `unit` để tương thích cũ, nhưng API mới nên ưu tiên `department_id`

---

# Thiết kế dữ liệu yêu cầu

## 1. Không tạo lại bảng users
Chỉ tạo migration alter table để thêm field mới nếu cần.

## 2. Cần bổ sung tối thiểu các field sau vào `users`
Nếu chưa có thì thêm:
- `department_id` bigint nullable, foreign key tới `departments.id`
- `note` text nullable
- `last_login_at` timestamp nullable

## 3. Không xóa các field cũ đang tồn tại
Giữ nguyên các field cũ:
- `role`
- `role_label`
- `unit`
- `is_active`

## 4. Cách hiểu field cũ
- `role`, `role_label`, `unit` chỉ là legacy data
- API mới có thể tiếp tục trả ra nếu cần backward compatibility
- Nhưng role thực tế của user phải lấy từ `user_role_assignments`

---

# Các bảng liên quan giả định đã có hoặc sẽ có từ module IAM trước đó
Prompt này giả định project đã có hoặc sẽ có các bảng sau:
- `roles`
- `user_role_assignments`

## Giả định tối thiểu về `user_role_assignments`
Bảng này nên có:
- `id`
- `user_id`
- `role_id`
- `is_active`
- `start_at` nullable
- `end_at` nullable
- `created_at`
- `updated_at`

Nếu trong source hiện tại chưa có thì hãy tạo đúng theo convention của dự án.

---

# API cần xây dựng

## 1. GET /admin/users
Lấy danh sách user có phân trang + filter.

### Query params hỗ trợ
- `page`
- `perPage`
- `keyword` tìm theo `full_name`, `email`, `phone`
- `departmentId`
- `roleId`
- `isActive`
- `sortBy`
- `order`

### Yêu cầu
- Trả danh sách user
- Kèm danh sách role đang được gán cho từng user
- Nếu có department thì kèm thông tin department cơ bản
- Sắp xếp mặc định theo `id desc`

---

## 2. GET /admin/users/:id
Lấy chi tiết user.

### Yêu cầu
Trả về:
- thông tin user
- department
- danh sách role đang active

---

## 3. POST /admin/users
Tạo user mới.

### Payload nghiệp vụ đề xuất
```json
{
  "fullName": "Nguyễn Văn A",
  "email": "a@example.com",
  "phone": "0901234567",
  "departmentId": 1,
  "password": "12345678",
  "confirmPassword": "12345678",
  "roleIds": [1, 2],
  "isActive": true,
  "note": "Tài khoản giảng viên"
}
```

### Yêu cầu
- validate email unique
- validate password và confirmPassword khớp nhau
- tạo user vào bảng `users`
- gán role qua bảng `user_role_assignments`
- không dùng field `users.role` làm nguồn phân quyền chính nữa
- nếu cần backward compatibility, có thể map `users.role` = role đầu tiên hoặc role mặc định, nhưng phải ghi chú rõ trong code rằng đây là legacy compatibility

---

## 4. PUT /admin/users/:id
Cập nhật user.

### Cho phép cập nhật
- `fullName`
- `email`
- `phone`
- `departmentId`
- `isActive`
- `note`

### Không cập nhật password ở API này
Password phải dùng API reset riêng.

### Có thể cho cập nhật `roleIds` luôn ở đây hoặc tách API riêng
Nhưng tốt nhất vẫn có API assign role riêng như bên dưới.

---

## 5. PATCH /admin/users/:id/status
Đổi trạng thái active/inactive.

### Body mẫu
```json
{
  "isActive": false
}
```

---

## 6. PATCH /admin/users/:id/reset-password
Reset mật khẩu user.

### Body mẫu
```json
{
  "password": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

### Yêu cầu
- validate password hợp lệ
- confirmPassword khớp
- update password user bằng cơ chế hash hiện tại của Adonis

---

## 7. GET /admin/users/:id/roles
Lấy danh sách role được gán cho user.

### Yêu cầu
- trả tất cả role assignment
- ưu tiên role active
- có thể trả thêm metadata `isActive`, `startAt`, `endAt`

---

## 8. PUT /admin/users/:id/roles
Gán lại danh sách role cho user.

### Body mẫu
```json
{
  "roleIds": [1, 3, 5]
}
```

### Yêu cầu
- Đây là API replace toàn bộ role active hiện tại của user
- Không xóa cứng lịch sử nếu muốn giữ, nhưng ở phase này có thể đơn giản bằng cách:
  - deactivate các assignment cũ
  - thêm assignment mới
- Hoặc nếu codebase đơn giản hơn, có thể sync theo cách hợp lý
- Tránh duplicate role assignment active

---

# Yêu cầu kỹ thuật chi tiết

## 1. Migration
Tạo migration alter `users` để thêm các cột nếu chưa có:
- `department_id`
- `note`
- `last_login_at`

### Yêu cầu migration
- dùng `alterTable`
- không phá dữ liệu cũ
- thêm foreign key tới `departments.id` nếu bảng departments đã có
- nếu cần index thì thêm index cho `department_id`, `is_active`, `email`

---

## 2. User model
Cập nhật `app/models/user.ts`

### Yêu cầu
- giữ nguyên flow auth hiện tại
- thêm các field mới nếu có
- thêm quan hệ:
  - `belongsTo` Department
  - `hasMany` UserRoleAssignment
  - `manyToMany` Role nếu phù hợp với style dự án, hoặc preload qua assignment

### Lưu ý
- không làm vỡ auth finder hiện tại
- không đổi `uids: ['email']`

---

## 3. Model liên quan
Nếu chưa có thì tạo / hoàn thiện:
- `Role`
- `UserRoleAssignment`
- `Department`

Chỉ tạo vừa đủ để user management hoạt động tốt.

---

## 4. Validators
Tạo validator riêng bằng VineJS cho từng use case:
- `create_iam_user_validator.ts`
- `update_iam_user_validator.ts`
- `update_iam_user_status_validator.ts`
- `reset_iam_user_password_validator.ts`
- `assign_user_roles_validator.ts`

### Validate rule gợi ý
- `email`: bắt buộc, đúng format, unique khi create
- `fullName`: bắt buộc khi create
- `departmentId`: nullable hoặc required tùy rule hệ thống, nhưng nên validate tồn tại nếu có truyền vào
- `roleIds`: array số nguyên, không trùng
- `password`: min length hợp lý
- `confirmPassword`: phải match password

---

## 5. Service
Tạo service riêng:
`app/services/iam_user_service.ts`

Service nên có các hàm:
- `paginate(filters)`
- `findById(id)`
- `create(payload)`
- `update(id, payload)`
- `changeStatus(id, isActive)`
- `resetPassword(id, password)`
- `getRoles(id)`
- `assignRoles(id, roleIds)`

### Yêu cầu trong service
- controller phải mỏng
- validate business logic ở service
- check user tồn tại
- check email unique
- check department tồn tại nếu có departmentId
- check role tồn tại trước khi gán
- preload role/department hợp lý
- code clean, có thể maintain

---

## 6. Controller
Tạo controller mới cho IAM user management, không ghi đè lung tung controller cũ nếu chưa chắc.

### Gợi ý file
`app/controllers/admin/iam_users_controller.ts`

### Method cần có
- `index`
- `show`
- `store`
- `update`
- `changeStatus`
- `resetPassword`
- `roles`
- `assignRoles`

### Yêu cầu
- validate ở controller bằng validator
- gọi service
- response JSON rõ ràng, thống nhất

---

## 7. Route
Thêm route vào `start/routes.ts`

### Route mong muốn
- `GET /admin/users`
- `GET /admin/users/:id`
- `POST /admin/users`
- `PUT /admin/users/:id`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/reset-password`
- `GET /admin/users/:id/roles`
- `PUT /admin/users/:id/roles`

### Lưu ý
- đặt trong group `/admin`
- dùng auth middleware theo convention dự án
- nếu hệ IAM permission middleware đã có thì gắn thêm permission phù hợp:
  - `user.view`
  - `user.create`
  - `user.update`
  - `user.change_status`
  - `user.reset_password`
  - `user.assign_role`

---

# Response format mong muốn

## Response list
```json
{
  "message": "Users fetched successfully",
  "data": [
    {
      "id": 1,
      "fullName": "Nguyễn Văn A",
      "email": "a@example.com",
      "phone": "0901234567",
      "department": {
        "id": 1,
        "name": "Khoa Toán",
        "code": "KTOAN"
      },
      "roles": [
        {
          "id": 1,
          "code": "SCIENTIST",
          "name": "Nhà khoa học"
        },
        {
          "id": 2,
          "code": "DEPARTMENT_HEAD",
          "name": "Trưởng đơn vị"
        }
      ],
      "legacyRole": "NCV",
      "isActive": true,
      "lastLoginAt": null,
      "createdAt": "...",
      "updatedAt": "..."
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
  "message": "User fetched successfully",
  "data": {
    "id": 1,
    "fullName": "Nguyễn Văn A",
    "email": "a@example.com",
    "phone": "0901234567",
    "department": {
      "id": 1,
      "name": "Khoa Toán",
      "code": "KTOAN"
    },
    "roles": [
      {
        "id": 1,
        "code": "SCIENTIST",
        "name": "Nhà khoa học",
        "isActive": true
      }
    ],
    "legacyRole": "NCV",
    "legacyRoleLabel": "Nhà khoa học",
    "unit": "Khoa Toán",
    "isActive": true,
    "note": "Tài khoản giảng viên",
    "lastLoginAt": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

# Business rule rất quan trọng

## 1. Không được phá module auth cũ
- không thay email login
- không thay password hashing
- không drop field cũ

## 2. Không được coi `users.role` là nguồn phân quyền chính nữa
- role thực phải lấy từ `user_role_assignments`
- `users.role` chỉ là legacy compatibility

## 3. Khi assign role cho user
- không tạo duplicate active role assignment
- roleIds phải hợp lệ

## 4. Không xóa cứng user trong phase này
- chỉ dùng `is_active`

## 5. Không reset password trong API update user chung
- phải tách API riêng

## 6. Nếu department chưa bắt buộc toàn hệ thống
- cho phép `department_id` nullable
- nhưng nếu truyền lên thì phải validate tồn tại

---

# Coding style yêu cầu
- Bám sát style hiện tại của source backend
- Không phá code cũ đang chạy
- Không over-engineering
- Không rewrite toàn bộ module user cũ nếu không cần
- Ưu tiên thêm controller/service/validator mới cho IAM user management
- Nếu phải sửa User model, hãy sửa tối thiểu và an toàn
- Chú thích rõ phần nào là legacy compatibility

---

# Yêu cầu đầu ra
Hãy thực hiện toàn bộ thay đổi cần thiết và trả về:

1. Danh sách file mới / file sửa
2. Nội dung code đầy đủ của từng file
3. Nếu sửa migration/model/route thì ghi rõ từng thay đổi
4. Nếu cần migrate/seeder thì liệt kê lệnh chạy cuối cùng
5. Giải thích ngắn gọn cách đảm bảo tương thích với bảng `users` hiện có

Hãy code hoàn chỉnh, nhất quán, chạy được, và đặc biệt **không tạo lại bảng `users`**.
