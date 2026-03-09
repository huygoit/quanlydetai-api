# Nhiệm vụ
Hãy xây dựng đầy đủ **API phân quyền (IAM / Authorization)** cho dự án backend **AdonisJS v6 + Lucid + PostgreSQL** theo đúng kiến trúc source hiện tại.

## Bối cảnh dự án
- Đây là hệ thống quản lý đề tài khoa học và chuyển đổi số.
- Backend hiện dùng:
  - AdonisJS v6
  - Lucid ORM
  - PostgreSQL
  - VineJS validator
- Kiến trúc hiện tại của dự án đang theo hướng:
  - `app/controllers`
  - `app/models`
  - `app/services`
  - `app/validators`
  - `app/middleware`
  - `database/migrations`
  - `database/seeders`
  - `start/routes.ts`
- Dự án đã có auth và user cơ bản. Hãy bám sát convention code hiện có, không phá kiến trúc cũ.

---

# Mục tiêu
Xây dựng module **phân quyền chuẩn** làm nền cho toàn hệ thống theo mô hình:

**RBAC + Permission-based Access**

Ở phase này, chỉ tập trung vào nền tảng IAM backend:
- quản lý roles
- quản lý permissions
- gán permissions cho roles
- gán roles cho users
- middleware kiểm tra permission ở route level

---

# Phạm vi phase này
## Làm trong phase này
- `roles`
- `permissions`
- `role_permissions`
- `user_role_assignments`
- API quản lý role
- API quản lý permission
- API gán permission cho role
- API gán role cho user
- middleware `permission_middleware.ts`
- helper/service để check permission của user

## Chưa làm trong phase này
- chưa cần data scope sâu như `OWN / DEPARTMENT / ASSIGNED / ALL`
- chưa cần workflow engine
- chưa cần policy theo từng bản ghi cụ thể
- chưa cần role theo project/council scope
- chưa cần UI frontend

Tuy nhiên, kiến trúc code phải đủ sạch để phase sau mở rộng thêm scope và workflow.

---

# Thiết kế dữ liệu yêu cầu

## 1. Bảng `roles`
Các cột:
- `id`
- `code` (unique)
- `name`
- `description` nullable
- `status` (`ACTIVE`, `INACTIVE`)
- `created_at`
- `updated_at`

## 2. Bảng `permissions`
Các cột:
- `id`
- `code` (unique) — format chuẩn `module.action`
- `name`
- `module`
- `action`
- `description` nullable
- `status` (`ACTIVE`, `INACTIVE`)
- `created_at`
- `updated_at`

## 3. Bảng `role_permissions`
Các cột:
- `id`
- `role_id`
- `permission_id`
- `created_at`
- unique composite (`role_id`, `permission_id`)

## 4. Bảng `user_role_assignments`
Các cột:
- `id`
- `user_id`
- `role_id`
- `is_active` boolean default true
- `start_at` nullable
- `end_at` nullable
- `created_at`
- `updated_at`

### Rule
- một user có thể có nhiều role
- một role có thể gán cho nhiều user
- không cho trùng assignment đang giống nhau theo cặp `user_id + role_id`

---

# Quy tắc nghiệp vụ

## 1. Role code đề xuất seed sẵn
- `SUPER_ADMIN`
- `SYSTEM_ADMIN`
- `RESEARCH_OFFICE`
- `RESEARCH_MANAGER`
- `DEPARTMENT_HEAD`
- `DEPARTMENT_STAFF`
- `SCIENTIST`
- `PROJECT_OWNER`
- `PROJECT_MEMBER`
- `COUNCIL_CHAIR`
- `COUNCIL_SECRETARY`
- `COUNCIL_MEMBER`
- `REVIEWER`
- `FINANCE_OFFICER`
- `FINANCE_APPROVER`

## 2. Permission code phải theo chuẩn
Format:
- `department.view`
- `department.create`
- `user.assign_role`
- `project.approve`

Không dùng format tùy ý.

## 3. Permission seed mẫu
Ít nhất seed sẵn các permission sau:

### Department
- `department.view`
- `department.create`
- `department.update`
- `department.change_status`

### User
- `user.view`
- `user.create`
- `user.update`
- `user.change_status`
- `user.assign_role`

### Role
- `role.view`
- `role.create`
- `role.update`
- `role.assign_permission`

### Permission
- `permission.view`

### Profile
- `profile.view_own`
- `profile.update_own`
- `profile.view_department`
- `profile.view_all`
- `profile.verify`

### Idea
- `idea.view`
- `idea.create`
- `idea.update`
- `idea.submit`
- `idea.review`
- `idea.approve`

### Project
- `project.view`
- `project.create`
- `project.update`
- `project.submit`
- `project.review`
- `project.approve`
- `project.assign_reviewer`
- `project.acceptance`
- `project.liquidation`

### Council
- `council.view`
- `council.create`
- `council.update`
- `council.assign_member`
- `council.score`

### Publication
- `publication.view`
- `publication.create`
- `publication.update`
- `publication.review`
- `publication.approve`

### Report / Dashboard
- `report.view_department`
- `report.view_all`
- `report.export`
- `dashboard.view_department`
- `dashboard.view_all`

### System
- `audit_log.view`
- `notification.view`
- `system_config.view`
- `system_config.update`

## 4. Mapping role → permission seed cơ bản
Hãy seed mapping cơ bản hợp lý:

### SUPER_ADMIN
- có tất cả permissions

### SYSTEM_ADMIN
- department.*
- user.*
- role.*
- permission.view
- system_config.view
- system_config.update
- audit_log.view

### RESEARCH_OFFICE
- profile.view_all
- idea.view / review / approve
- project.view / review / approve / assign_reviewer / acceptance / liquidation
- council.view / create / update / assign_member
- publication.view / review / approve
- report.view_all / export
- dashboard.view_all

### DEPARTMENT_HEAD
- profile.view_department
- idea.view / review / approve
- project.view / review / approve
- report.view_department
- dashboard.view_department

### SCIENTIST
- profile.view_own
- profile.update_own
- idea.view / create / update / submit
- project.view / create / update / submit
- publication.view / create / update

Mapping không cần cực kỳ hoàn hảo ở phase đầu nhưng phải hợp lý và dễ mở rộng.

---

# API cần xây dựng

## A. Role APIs
### 1. GET /admin/roles
Danh sách role có phân trang, filter, search.

### Query params hỗ trợ
- `page`
- `perPage`
- `keyword` tìm theo `code`, `name`
- `status`
- `sortBy`
- `order`

### 2. GET /admin/roles/:id
Lấy chi tiết role.

### 3. POST /admin/roles
Tạo mới role.

### 4. PUT /admin/roles/:id
Cập nhật role.

### 5. PATCH /admin/roles/:id/status
Cập nhật trạng thái role.

### 6. GET /admin/roles/:id/permissions
Lấy danh sách permissions của role.

### 7. PUT /admin/roles/:id/permissions
Gán lại toàn bộ permissions cho role.

#### Body mẫu
```json
{
  "permissionIds": [1, 2, 3]
}
```

---

## B. Permission APIs
### 1. GET /admin/permissions
Danh sách permission có filter/search.

### Query params hỗ trợ
- `page`
- `perPage`
- `keyword` tìm theo `code`, `name`
- `module`
- `status`
- `sortBy`
- `order`

### 2. GET /admin/permissions/:id
Chi tiết permission.

### 3. POST /admin/permissions
Tạo mới permission.

### 4. PUT /admin/permissions/:id
Cập nhật permission.

### 5. PATCH /admin/permissions/:id/status
Cập nhật trạng thái permission.

---

## C. User role assignment APIs
### 1. GET /admin/users/:userId/roles
Lấy danh sách role đang gán cho user.

### 2. PUT /admin/users/:userId/roles
Gán lại toàn bộ role cho user.

#### Body mẫu
```json
{
  "roleIds": [1, 2, 3]
}
```

### 3. POST /admin/users/:userId/roles
Gán thêm 1 role cho user.

#### Body mẫu
```json
{
  "roleId": 2,
  "isActive": true,
  "startAt": null,
  "endAt": null
}
```

### 4. PATCH /admin/users/:userId/roles/:assignmentId/status
Bật/tắt assignment role của user.

#### Body mẫu
```json
{
  "isActive": true
}
```

---

# Middleware và service check permission

## 1. Tạo middleware mới
Tạo middleware:
- `app/middleware/permission_middleware.ts`

## 2. Chức năng
Middleware phải:
- lấy user hiện tại từ auth
- kiểm tra user có ít nhất 1 role active
- từ role active suy ra permissions active
- kiểm tra user có permission yêu cầu hay không
- nếu không có quyền thì trả 403

## 3. Cách dùng
Phải hỗ trợ route middleware kiểu:
```ts
.use(middleware.permission(['department.view']))
```
hoặc theo convention phù hợp với AdonisJS v6 hiện tại.

Nếu cần, có thể hỗ trợ 1 hoặc nhiều permission truyền vào.

## 4. Tạo helper/service
Tạo service hỗ trợ check quyền, ví dụ:
- `app/services/permission_service.ts`

Service nên có các hàm như:
- `getUserPermissions(userId)`
- `userHasPermission(userId, permissionCode)`
- `getUserRoles(userId)`

Ưu tiên tách logic khỏi middleware để dễ tái sử dụng.

---

# Yêu cầu kỹ thuật

## 1. Migration
Tạo migrations cho:
- `roles`
- `permissions`
- `role_permissions`
- `user_role_assignments`

Thêm đầy đủ:
- PK
- FK
- unique constraints
- indexes cần thiết

### Index gợi ý
#### roles
- `code`
- `status`

#### permissions
- `code`
- `module`
- `status`

#### role_permissions
- `role_id`
- `permission_id`
- unique (`role_id`, `permission_id`)

#### user_role_assignments
- `user_id`
- `role_id`
- `is_active`
- unique (`user_id`, `role_id`)

---

## 2. Models
Tạo các model:
- `app/models/role.ts`
- `app/models/permission.ts`
- `app/models/role_permission.ts`
- `app/models/user_role_assignment.ts`

### Quan hệ yêu cầu
#### Role
- many-to-many với Permission qua `role_permissions`
- has-many `user_role_assignments`

#### Permission
- many-to-many với Role

#### UserRoleAssignment
- belongs-to User
- belongs-to Role

Nếu phù hợp, cập nhật luôn `user.ts` để có quan hệ với `user_role_assignments` hoặc roles.

---

## 3. Validators
Tạo validator bằng VineJS cho:

### Role
- `create_role_validator.ts`
- `update_role_validator.ts`
- `update_role_status_validator.ts`
- `sync_role_permissions_validator.ts`

### Permission
- `create_permission_validator.ts`
- `update_permission_validator.ts`
- `update_permission_status_validator.ts`

### User role assignment
- `assign_user_role_validator.ts`
- `sync_user_roles_validator.ts`
- `update_user_role_assignment_status_validator.ts`

### Rule validate chính
- `role.code` unique
- `permission.code` unique
- `permission.code` phải đúng format `module.action`
- `module` và `action` nên parse/validate rõ ràng
- `permissionIds` là mảng số nguyên hợp lệ
- `roleIds` là mảng số nguyên hợp lệ

---

## 4. Services
Tạo service tương ứng, ví dụ:
- `app/services/role_service.ts`
- `app/services/permission_service.ts`
- `app/services/user_role_assignment_service.ts`

### Role service nên có
- `paginate`
- `findById`
- `create`
- `update`
- `updateStatus`
- `getPermissions`
- `syncPermissions`

### Permission service nên có
- `paginate`
- `findById`
- `create`
- `update`
- `updateStatus`
- `getUserPermissions`
- `userHasPermission`

### User role assignment service nên có
- `getUserRoles`
- `syncUserRoles`
- `assignRole`
- `updateAssignmentStatus`

### Yêu cầu
- controller mỏng
- business logic nằm ở service
- xử lý not found rõ ràng
- xử lý duplicate rõ ràng
- code clean, dễ maintain

---

## 5. Controllers
Tạo controller quản trị tại nhánh `app/controllers/admin/`:
- `roles_controller.ts`
- `permissions_controller.ts`
- `user_role_assignments_controller.ts`

### Role controller methods
- `index`
- `show`
- `store`
- `update`
- `changeStatus`
- `permissions`
- `syncPermissions`

### Permission controller methods
- `index`
- `show`
- `store`
- `update`
- `changeStatus`

### User role assignment controller methods
- `userRoles`
- `syncUserRoles`
- `assignRole`
- `changeAssignmentStatus`

---

# Route yêu cầu
Thêm route vào `start/routes.ts` theo group `/admin`.
Nếu dự án đang có auth middleware, hãy dùng cùng convention hiện tại.

## Roles
- `GET /admin/roles`
- `GET /admin/roles/:id`
- `POST /admin/roles`
- `PUT /admin/roles/:id`
- `PATCH /admin/roles/:id/status`
- `GET /admin/roles/:id/permissions`
- `PUT /admin/roles/:id/permissions`

## Permissions
- `GET /admin/permissions`
- `GET /admin/permissions/:id`
- `POST /admin/permissions`
- `PUT /admin/permissions/:id`
- `PATCH /admin/permissions/:id/status`

## User role assignments
- `GET /admin/users/:userId/roles`
- `PUT /admin/users/:userId/roles`
- `POST /admin/users/:userId/roles`
- `PATCH /admin/users/:userId/roles/:assignmentId/status`

---

# Bảo vệ route bằng permission middleware
Sau khi tạo middleware, áp dụng mẫu hợp lý cho một vài route ví dụ:
- `GET /admin/roles` cần `role.view`
- `POST /admin/roles` cần `role.create`
- `PUT /admin/roles/:id/permissions` cần `role.assign_permission`
- `GET /admin/permissions` cần `permission.view`
- `PUT /admin/users/:userId/roles` cần `user.assign_role`

Nếu route department hiện có, hãy minh họa luôn cách gắn middleware permission cho module department.

---

# Format response yêu cầu
## List response
```json
{
  "message": "Roles fetched successfully",
  "data": [],
  "meta": {
    "total": 0,
    "perPage": 10,
    "currentPage": 1,
    "lastPage": 1
  }
}
```

## Detail response
```json
{
  "message": "Role fetched successfully",
  "data": {
    "id": 1,
    "code": "SYSTEM_ADMIN",
    "name": "System Admin",
    "description": "System administrator",
    "status": "ACTIVE",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Sync response
```json
{
  "message": "Role permissions updated successfully",
  "data": {
    "roleId": 1,
    "permissionIds": [1, 2, 3]
  }
}
```

## User roles response
```json
{
  "message": "User roles fetched successfully",
  "data": [
    {
      "assignmentId": 1,
      "roleId": 2,
      "roleCode": "SCIENTIST",
      "roleName": "Scientist",
      "isActive": true,
      "startAt": null,
      "endAt": null
    }
  ]
}
```

---

# Error handling
Xử lý các case:
- không tìm thấy role / permission / user / assignment -> 404
- duplicate code -> 422 hoặc chuẩn đang dùng trong dự án
- validate fail -> theo chuẩn Vine/Adonis hiện tại
- permission code sai format -> 422
- user không có permission -> 403
- user chưa login -> 401
- assignment không thuộc đúng user -> xử lý an toàn, không cập nhật nhầm

---

# Seeders yêu cầu
Tạo seeder hoặc nhóm seeders cho:
- roles
- permissions
- role_permissions

Ít nhất seed:
- danh sách role chuẩn
- danh sách permission chuẩn
- mapping cơ bản cho `SUPER_ADMIN`, `SYSTEM_ADMIN`, `RESEARCH_OFFICE`, `DEPARTMENT_HEAD`, `SCIENTIST`

Nếu dự án đã có user admin seed sẵn, có thể gán `SUPER_ADMIN` cho user admin đó theo convention phù hợp.

---

# Coding style yêu cầu
- Bám sát style source hiện tại
- Không over-engineering
- Không thêm scope phức tạp ở phase này
- Không thêm workflow engine ở phase này
- Không phá auth hiện tại
- Không tự ý đổi cấu trúc lớn ngoài phạm vi IAM
- Ưu tiên code rõ ràng, dễ maintain
- Tận dụng service layer thay vì nhét logic vào controller

---

# Yêu cầu đầu ra
Hãy thực hiện toàn bộ thay đổi cần thiết và trả về:

1. Danh sách file mới / file đã sửa
2. Nội dung code đầy đủ cho từng file
3. Nếu cần sửa `user.ts`, `start/routes.ts`, middleware kernel hoặc config liên quan, hãy chỉ rõ chính xác phần code cần thêm/sửa
4. Nếu cần chạy lệnh, liệt kê cuối cùng:
   - migration command
   - seeder command
5. Nếu có giả định nào về cấu trúc source hiện tại, hãy nêu ngắn gọn trước khi code

Hãy code hoàn chỉnh, nhất quán, chạy được, bám sát AdonisJS v6.
