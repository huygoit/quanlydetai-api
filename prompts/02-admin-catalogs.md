# Prompt 02: Admin & Catalogs Module

Tôi cần bạn tạo API Quản trị hệ thống cho hệ thống "Quản lý KH&CN" bằng AdonisJS + PostgreSQL.

**Lưu ý:** Module này cần được tạo sớm vì các module khác sẽ sử dụng AuditLogService và Catalogs.

Tất cả API trong module này yêu cầu role = ADMIN (trừ API public lấy catalog).

## 1. Database Schema

### Bảng `system_configs`
```sql
- id: bigint, PK
- key: varchar(100), unique, not null
- value: text
- description: varchar(500), nullable
- updated_at: timestamp
- created_at: timestamp
```

### Bảng `audit_logs`
```sql
- id: bigint, PK
- user_id: bigint, FK to users, nullable
- user_name: varchar(255)
- action: varchar(50) -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, SUBMIT, APPROVE, REJECT, etc.
- entity_type: varchar(50) -- USER, IDEA, PROJECT, PROFILE, NOTIFICATION, etc.
- entity_id: varchar(50), nullable
- old_data: jsonb, nullable
- new_data: jsonb, nullable
- ip_address: varchar(50)
- user_agent: text
- created_at: timestamp
```

### Bảng `catalogs` (danh mục dùng chung)
```sql
- id: bigint, PK
- type: varchar(50), not null -- FIELD, UNIT, PROJECT_LEVEL, LANGUAGE, etc.
- code: varchar(50), not null
- name: varchar(255), not null
- description: text, nullable
- sort_order: integer, default 0
- is_active: boolean, default true
- parent_id: bigint, nullable (FK to catalogs, for hierarchical)
- metadata: jsonb, nullable -- extra data như color, icon
- created_at: timestamp
- updated_at: timestamp
- UNIQUE(type, code)
```

## 2. API Endpoints

### System Config APIs (ADMIN only)

#### GET /api/admin/configs
Response:
```json
{
  "success": true,
  "data": [
    { "key": "app_name", "value": "Hệ thống Quản lý KH&CN", "description": "Tên ứng dụng" },
    { "key": "max_file_size_mb", "value": "10", "description": "Kích thước file tối đa (MB)" }
  ]
}
```

#### GET /api/admin/configs/:key

#### PUT /api/admin/configs/:key
Request:
```json
{ "value": "string", "description": "string (optional)" }
```

### Audit Log APIs (ADMIN only)

#### GET /api/admin/audit-logs
Query params: `userId`, `action`, `entityType`, `startDate`, `endDate`, `page`, `perPage`
Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "userName": "Admin",
      "action": "CREATE",
      "entityType": "USER",
      "entityId": "5",
      "oldData": null,
      "newData": { "email": "test@email.com", "fullName": "Test" },
      "ipAddress": "192.168.1.1",
      "createdAt": "2024-03-15T10:00:00Z"
    }
  ],
  "meta": { "total": 100, "currentPage": 1, "perPage": 20, "lastPage": 5 }
}
```

### Catalog APIs

#### GET /api/admin/catalogs (ADMIN only)
Query params: `type`, `isActive`, `keyword`, `page`, `perPage`

#### GET /api/admin/catalogs/:id (ADMIN only)

#### POST /api/admin/catalogs (ADMIN only)
Request:
```json
{
  "type": "FIELD",
  "code": "CNTT",
  "name": "Công nghệ thông tin",
  "description": "Lĩnh vực CNTT",
  "sortOrder": 1,
  "parentId": null,
  "metadata": { "color": "#1890ff", "icon": "LaptopOutlined" }
}
```

#### PUT /api/admin/catalogs/:id (ADMIN only)

#### DELETE /api/admin/catalogs/:id (ADMIN only)
- Soft delete: set isActive = false

#### GET /api/catalogs/by-type/:type (PUBLIC - không cần auth)
- Lấy danh mục theo type để dùng trong dropdown
- Chỉ trả về isActive = true
Response:
```json
{
  "success": true,
  "data": [
    { "code": "CNTT", "name": "Công nghệ thông tin" },
    { "code": "KINH_TE", "name": "Kinh tế - Quản lý" }
  ]
}
```

## 3. AuditLogService

Tạo service để các module khác gọi khi cần ghi log:

```typescript
// app/services/audit_log_service.ts
import AuditLog from '#models/audit_log'
import { HttpContext } from '@adonisjs/core/http'

export default class AuditLogService {
  /**
   * Ghi audit log
   */
  static async log(data: {
    userId?: number | null
    userName: string
    action: string
    entityType: string
    entityId?: string | null
    oldData?: object | null
    newData?: object | null
    ctx?: HttpContext
  }) {
    const ipAddress = data.ctx?.request.ip() || 'unknown'
    const userAgent = data.ctx?.request.header('user-agent') || 'unknown'

    await AuditLog.create({
      userId: data.userId,
      userName: data.userName,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      oldData: data.oldData,
      newData: data.newData,
      ipAddress,
      userAgent,
    })
  }

  /**
   * Log khi tạo mới
   */
  static async logCreate(entityType: string, entityId: string, newData: object, ctx?: HttpContext) {
    const user = ctx?.auth?.user
    await this.log({
      userId: user?.id,
      userName: user?.fullName || 'System',
      action: 'CREATE',
      entityType,
      entityId,
      newData,
      ctx,
    })
  }

  /**
   * Log khi cập nhật
   */
  static async logUpdate(entityType: string, entityId: string, oldData: object, newData: object, ctx?: HttpContext) {
    const user = ctx?.auth?.user
    await this.log({
      userId: user?.id,
      userName: user?.fullName || 'System',
      action: 'UPDATE',
      entityType,
      entityId,
      oldData,
      newData,
      ctx,
    })
  }

  /**
   * Log khi xóa
   */
  static async logDelete(entityType: string, entityId: string, oldData: object, ctx?: HttpContext) {
    const user = ctx?.auth?.user
    await this.log({
      userId: user?.id,
      userName: user?.fullName || 'System',
      action: 'DELETE',
      entityType,
      entityId,
      oldData,
      ctx,
    })
  }
}
```

## 4. Seed Data

### Default System Configs
```typescript
const configs = [
  { key: 'app_name', value: 'Hệ thống Quản lý KH&CN', description: 'Tên ứng dụng' },
  { key: 'app_version', value: '1.0.0', description: 'Phiên bản' },
  { key: 'max_file_size_mb', value: '10', description: 'Kích thước file tối đa (MB)' },
  { key: 'allowed_file_types', value: 'pdf,doc,docx,xls,xlsx,jpg,png', description: 'Loại file cho phép' },
  { key: 'session_timeout_minutes', value: '480', description: 'Thời gian hết hạn session (phút)' },
  { key: 'council_threshold_score', value: '7.0', description: 'Ngưỡng điểm đề xuất đặt hàng' },
]
```

### Default Catalogs

#### Type: FIELD (Lĩnh vực khoa học)
```typescript
const fields = [
  { code: 'CNTT', name: 'Công nghệ thông tin', sortOrder: 1 },
  { code: 'KINH_TE', name: 'Kinh tế - Quản lý', sortOrder: 2 },
  { code: 'KHXH', name: 'Khoa học xã hội', sortOrder: 3 },
  { code: 'KY_THUAT', name: 'Kỹ thuật - Công nghệ', sortOrder: 4 },
  { code: 'Y_DUOC', name: 'Y - Dược', sortOrder: 5 },
  { code: 'NONG_NGHIEP', name: 'Nông nghiệp - Sinh học', sortOrder: 6 },
  { code: 'KHTN', name: 'Khoa học tự nhiên', sortOrder: 7 },
  { code: 'GIAO_DUC', name: 'Giáo dục', sortOrder: 8 },
]
```

#### Type: UNIT (Đơn vị)
```typescript
const units = [
  { code: 'KHOA_CNTT', name: 'Khoa Công nghệ thông tin', sortOrder: 1 },
  { code: 'KHOA_KINH_TE', name: 'Khoa Kinh tế', sortOrder: 2 },
  { code: 'KHOA_NGOAI_NGU', name: 'Khoa Ngoại ngữ', sortOrder: 3 },
  { code: 'KHOA_LUAT', name: 'Khoa Luật', sortOrder: 4 },
  { code: 'KHOA_Y', name: 'Khoa Y', sortOrder: 5 },
  { code: 'KHOA_DUOC', name: 'Khoa Dược', sortOrder: 6 },
  { code: 'KHOA_NONG_NGHIEP', name: 'Khoa Nông nghiệp', sortOrder: 7 },
  { code: 'VIEN_CNTT', name: 'Viện Nghiên cứu CNTT', sortOrder: 8 },
  { code: 'TRUNG_TAM_KHXH', name: 'Trung tâm Khoa học Xã hội', sortOrder: 9 },
  { code: 'PHONG_KH', name: 'Phòng Khoa học', sortOrder: 10 },
]
```

#### Type: PROJECT_LEVEL (Cấp đề tài)
```typescript
const levels = [
  { code: 'CO_SO', name: 'Cấp cơ sở', sortOrder: 1 },
  { code: 'TRUONG', name: 'Cấp Trường', sortOrder: 2 },
  { code: 'BO', name: 'Cấp Bộ', sortOrder: 3 },
  { code: 'NHA_NUOC', name: 'Cấp Nhà nước', sortOrder: 4 },
]
```

#### Type: IDEA_LEVEL (Cấp đề tài phù hợp cho ý tưởng)
```typescript
const ideaLevels = [
  { code: 'TRUONG_THUONG_NIEN', name: 'Cấp trường thường niên', sortOrder: 1 },
  { code: 'TRUONG_DAT_HANG', name: 'Cấp trường đặt hàng', sortOrder: 2 },
  { code: 'DAI_HOC_DA_NANG', name: 'Cấp Đại học Đà Nẵng', sortOrder: 3 },
  { code: 'BO_GDDT', name: 'Cấp Bộ GD&ĐT', sortOrder: 4 },
  { code: 'NHA_NUOC', name: 'Cấp Nhà nước', sortOrder: 5 },
  { code: 'NAFOSTED', name: 'NAFOSTED', sortOrder: 6 },
  { code: 'TINH_THANH_PHO', name: 'Cấp Tỉnh/Thành phố', sortOrder: 7 },
  { code: 'DOANH_NGHIEP', name: 'Doanh nghiệp', sortOrder: 8 },
]
```

#### Type: LANGUAGE (Ngoại ngữ)
```typescript
const languages = [
  { code: 'ENGLISH', name: 'Tiếng Anh', sortOrder: 1 },
  { code: 'FRENCH', name: 'Tiếng Pháp', sortOrder: 2 },
  { code: 'GERMAN', name: 'Tiếng Đức', sortOrder: 3 },
  { code: 'JAPANESE', name: 'Tiếng Nhật', sortOrder: 4 },
  { code: 'CHINESE', name: 'Tiếng Trung', sortOrder: 5 },
  { code: 'KOREAN', name: 'Tiếng Hàn', sortOrder: 6 },
]
```

## 5. Yêu cầu

Hãy tạo đầy đủ:
1. Migration files cho 3 bảng: system_configs, audit_logs, catalogs
2. Models: SystemConfig, AuditLog, Catalog
3. AdminController (configs, audit-logs)
4. CatalogsController
5. AuditLogService
6. Routes
7. Validators
8. Seeders (SystemConfigSeeder, CatalogSeeder)

## 6. Sau khi tạo xong, chạy:

```bash
# Chạy migration
node ace migration:run

# Chạy seeder
node ace db:seed
```
