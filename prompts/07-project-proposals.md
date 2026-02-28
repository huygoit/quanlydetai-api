# Prompt 07: Project Proposals Module (Đăng ký đề xuất đề tài - Giai đoạn 1)

Tôi cần bạn tạo API Đăng ký đề xuất đề tài cho hệ thống "Quản lý KH&CN" bằng AdonisJS + PostgreSQL.

## 1. Database Schema

### Bảng `project_proposals`
```sql
- id: bigint, PK
- code: varchar(20), unique -- VD: ĐT-2025-001
- title: varchar(500), not null
- field: varchar(100), not null
- level: varchar(20), not null -- CO_SO, TRUONG, BO, NHA_NUOC
- year: integer, not null
- duration_months: integer, not null
- keywords: jsonb, default '[]'
- created_at: timestamp
- updated_at: timestamp

-- Thông tin chủ nhiệm
- owner_id: bigint, FK to users, not null
- owner_name: varchar(255), not null
- owner_email: varchar(255), nullable
- owner_unit: varchar(255), not null
- co_authors: jsonb, default '[]' -- array of strings

-- Nội dung khoa học
- objectives: text, not null -- Mục tiêu
- summary: text, not null -- Tóm tắt
- content_outline: text, nullable -- Nội dung chính / đề cương
- expected_results: text, nullable -- Kết quả / sản phẩm dự kiến
- application_potential: text, nullable -- Khả năng ứng dụng

-- Kinh phí
- requested_budget_total: bigint, nullable -- VNĐ
- requested_budget_detail: text, nullable -- Mô tả chi tiết

-- Trạng thái
- status: varchar(20), default 'DRAFT'
  -- DRAFT, SUBMITTED, UNIT_REVIEWED, APPROVED, REJECTED, WITHDRAWN

-- Ý kiến Trưởng đơn vị
- unit_comment: text, nullable
- unit_approved: boolean, nullable

-- Ý kiến Phòng KH
- sci_dept_comment: text, nullable
- sci_dept_priority: varchar(10), nullable -- LOW, MEDIUM, HIGH
```

## 2. Workflow trạng thái

```
DRAFT → SUBMITTED → UNIT_REVIEWED → APPROVED
  ↓        ↓              ↓             
WITHDRAWN  WITHDRAWN   REJECTED/APPROVED
```

| Trạng thái | Mô tả | Ai chuyển |
|------------|-------|-----------|
| DRAFT | Bản nháp | NCV/CNDT tạo |
| SUBMITTED | Đã gửi đề xuất | NCV/CNDT submit |
| UNIT_REVIEWED | Trưởng đơn vị đã cho ý kiến | TRUONG_DON_VI review |
| APPROVED | Phòng KH phê duyệt | PHONG_KH approve |
| REJECTED | Không được duyệt | PHONG_KH reject |
| WITHDRAWN | Đã rút đề xuất | NCV/CNDT withdraw |

## 3. API Endpoints

### GET /api/project-proposals
Query params:
- `keyword`: tìm trong code, title, ownerName
- `year`: năm đề xuất
- `status`: trạng thái
- `level`: cấp đề tài
- `field`: lĩnh vực
- `unit`: đơn vị (dùng cho TRUONG_DON_VI lọc đơn vị của mình)
- `ownerOnly`: boolean - chỉ lấy của owner hiện tại
- `page`, `perPage`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "ĐT-2025-001",
      "title": "Nghiên cứu ứng dụng AI trong y khoa",
      "field": "Công nghệ thông tin",
      "level": "TRUONG",
      "year": 2025,
      "durationMonths": 18,
      "ownerId": 6,
      "ownerName": "Nguyễn Văn An",
      "ownerUnit": "Khoa CNTT",
      "status": "SUBMITTED",
      "requestedBudgetTotal": 450000000,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": { "total": 50, "currentPage": 1, "perPage": 10, "lastPage": 5 }
}
```

### GET /api/project-proposals/:id

Response (chi tiết đầy đủ):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "ĐT-2025-001",
    "title": "Nghiên cứu ứng dụng AI trong chẩn đoán bệnh lý hình ảnh y khoa",
    "field": "Công nghệ thông tin",
    "level": "TRUONG",
    "year": 2025,
    "durationMonths": 18,
    "keywords": ["AI", "Deep Learning", "Y khoa", "Chẩn đoán hình ảnh"],
    "createdAt": "2025-01-15T08:30:00Z",
    "updatedAt": "2025-01-20T14:20:00Z",
    
    "ownerId": 6,
    "ownerName": "Nguyễn Văn An",
    "ownerEmail": "an.nguyen@university.edu.vn",
    "ownerUnit": "Khoa Công nghệ thông tin",
    "coAuthors": ["PGS.TS. Trần Minh Hoàng", "ThS. Lê Thị Mai"],
    
    "objectives": "Phát triển hệ thống AI hỗ trợ chẩn đoán bệnh lý từ ảnh X-quang và CT scan.",
    "summary": "Đề tài tập trung nghiên cứu và phát triển thuật toán deep learning...",
    "contentOutline": "1. Tổng quan về AI trong y khoa\n2. Thu thập và xử lý dữ liệu\n3. Xây dựng mô hình\n4. Đánh giá và triển khai",
    "expectedResults": "- Bộ dữ liệu ảnh y khoa chuẩn hóa\n- Mô hình AI đạt độ chính xác > 90%\n- 02 bài báo khoa học quốc tế",
    "applicationPotential": "Ứng dụng trong các bệnh viện, phòng khám để hỗ trợ chẩn đoán nhanh và chính xác.",
    
    "requestedBudgetTotal": 450000000,
    "requestedBudgetDetail": "Chi phí nhân sự: 200tr\nThiết bị: 150tr\nVật tư, hóa chất: 50tr\nCông bố khoa học: 50tr",
    
    "status": "SUBMITTED",
    "unitComment": null,
    "unitApproved": null,
    "sciDeptComment": null,
    "sciDeptPriority": null
  }
}
```

**Khi đã có ý kiến đơn vị:**
```json
{
  "status": "UNIT_REVIEWED",
  "unitApproved": true,
  "unitComment": "Đề tài có ý nghĩa thực tiễn cao, phù hợp với định hướng nghiên cứu của Khoa."
}
```

**Khi đã được phê duyệt:**
```json
{
  "status": "APPROVED",
  "unitApproved": true,
  "unitComment": "Đề tài phù hợp, đề nghị phê duyệt.",
  "sciDeptPriority": "HIGH",
  "sciDeptComment": "Đề tài có tính thời sự cao, đề nghị ưu tiên thực hiện."
}
```

### POST /api/project-proposals
Request:
```json
{
  "title": "Nghiên cứu ứng dụng AI trong y khoa",
  "field": "Công nghệ thông tin",
  "level": "TRUONG",
  "year": 2025,
  "durationMonths": 18,
  "keywords": ["AI", "Deep Learning", "Y khoa"],
  "coAuthors": ["PGS.TS. Trần Minh Hoàng", "ThS. Lê Thị Mai"],
  "objectives": "Phát triển hệ thống AI hỗ trợ chẩn đoán...",
  "summary": "Đề tài tập trung nghiên cứu...",
  "contentOutline": "1. Tổng quan\n2. Thu thập dữ liệu\n3. Xây dựng mô hình",
  "expectedResults": "- Bộ dữ liệu chuẩn hóa\n- Mô hình AI",
  "applicationPotential": "Ứng dụng trong bệnh viện...",
  "requestedBudgetTotal": 450000000,
  "requestedBudgetDetail": "Chi phí nhân sự: 200tr\nThiết bị: 150tr..."
}
```
- Auto-generate code: ĐT-{year}-{sequence}
- owner_id, owner_name, owner_email, owner_unit từ current user
- status = DRAFT

### PUT /api/project-proposals/:id
- Chỉ cho phép khi status = DRAFT
- Chỉ owner

### DELETE /api/project-proposals/:id
- Chỉ cho phép khi status = DRAFT
- Chỉ owner

### POST /api/project-proposals/:id/submit
- DRAFT → SUBMITTED
- Chỉ owner
- Gọi AuditLogService.log()

### POST /api/project-proposals/:id/withdraw
- SUBMITTED → WITHDRAWN
- Chỉ owner
- Gọi AuditLogService.log()

### POST /api/project-proposals/:id/unit-review (TRUONG_DON_VI only)
Request:
```json
{
  "unitApproved": true,
  "unitComment": "Đề tài có ý nghĩa thực tiễn cao, phù hợp với định hướng của Khoa."
}
```
- SUBMITTED → UNIT_REVIEWED
- Điều kiện: proposal.ownerUnit phải thuộc đơn vị của TRUONG_DON_VI
- Gọi NotificationService.notifyProjectProposalStatusChanged()

### POST /api/project-proposals/:id/sci-dept-review (PHONG_KH only)
Request:
```json
{
  "status": "APPROVED",
  "sciDeptPriority": "HIGH",
  "sciDeptComment": "Đề tài có tính thời sự cao, đề nghị ưu tiên thực hiện."
}
```
- UNIT_REVIEWED → APPROVED hoặc REJECTED
- status trong request chỉ chấp nhận "APPROVED" hoặc "REJECTED"
- Gọi NotificationService.notifyProjectProposalStatusChanged()

## 4. Constants

```typescript
const FIELD_OPTIONS = [
  'Công nghệ thông tin',
  'Kinh tế - Quản lý',
  'Khoa học xã hội',
  'Kỹ thuật - Công nghệ',
  'Y - Dược',
  'Nông nghiệp - Sinh học',
  'Khoa học tự nhiên',
  'Giáo dục',
]

const LEVEL_OPTIONS = [
  { code: 'CO_SO', name: 'Cấp cơ sở' },
  { code: 'TRUONG', name: 'Cấp Trường' },
  { code: 'BO', name: 'Cấp Bộ' },
  { code: 'NHA_NUOC', name: 'Cấp Nhà nước' },
]

const UNIT_OPTIONS = [
  'Khoa Công nghệ thông tin',
  'Khoa Kinh tế',
  'Khoa Ngoại ngữ',
  'Khoa Luật',
  'Khoa Y',
  'Khoa Dược',
  'Khoa Nông nghiệp',
  'Viện Nghiên cứu CNTT',
  'Trung tâm Khoa học Xã hội',
]

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH']

const STATUS_CONFIG = {
  DRAFT: { label: 'Nháp', color: 'default' },
  SUBMITTED: { label: 'Đã gửi', color: 'processing' },
  UNIT_REVIEWED: { label: 'Đơn vị đã duyệt', color: 'cyan' },
  APPROVED: { label: 'Đã phê duyệt', color: 'success' },
  REJECTED: { label: 'Không phê duyệt', color: 'error' },
  WITHDRAWN: { label: 'Đã rút', color: 'warning' },
}
```

## 5. Helper: Generate Code

```typescript
async function generateProposalCode(year: number): Promise<string> {
  const lastProposal = await ProjectProposal.query()
    .where('code', 'like', `ĐT-${year}-%`)
    .orderBy('id', 'desc')
    .first()
  
  let sequence = 1
  if (lastProposal) {
    const lastSeq = parseInt(lastProposal.code.split('-')[2])
    sequence = lastSeq + 1
  }
  
  return `ĐT-${year}-${String(sequence).padStart(3, '0')}`
}
```

## 6. Business Logic

### Quyền truy cập
- NCV/CNDT: Xem/sửa/submit/withdraw đề xuất của mình
- TRUONG_DON_VI: Xem đề xuất của đơn vị mình, unit-review
- PHONG_KH: Xem tất cả, sci-dept-review
- ADMIN: Full access

### Kiểm tra đơn vị cho TRUONG_DON_VI
```typescript
// Trong unit-review endpoint
const proposal = await ProjectProposal.findOrFail(id)
const currentUserUnit = auth.user.unit

// Chỉ cho phép review nếu đề xuất thuộc đơn vị của mình
if (proposal.ownerUnit !== currentUserUnit) {
  return response.forbidden({ 
    success: false, 
    message: 'Bạn không có quyền duyệt đề xuất của đơn vị khác' 
  })
}
```

## 7. Seed Data

Tạo 7 proposals mẫu với các status khác nhau:
```typescript
const proposals = [
  {
    code: 'ĐT-2025-001',
    title: 'Nghiên cứu ứng dụng AI trong chẩn đoán bệnh lý hình ảnh y khoa',
    field: 'Công nghệ thông tin',
    level: 'TRUONG',
    year: 2025,
    durationMonths: 18,
    ownerName: 'Nguyễn Văn An',
    ownerUnit: 'Khoa Công nghệ thông tin',
    status: 'SUBMITTED',
    requestedBudgetTotal: 450000000,
    // ...
  },
  {
    code: 'ĐT-2025-002',
    title: 'Đánh giá hiệu quả mô hình kinh tế tuần hoàn',
    status: 'UNIT_REVIEWED',
    unitApproved: true,
    unitComment: 'Đề tài có ý nghĩa thực tiễn cao',
    // ...
  },
  {
    code: 'ĐT-2025-003',
    title: 'Phát triển hệ thống IoT giám sát nông nghiệp',
    status: 'DRAFT',
    // ...
  },
  {
    code: 'ĐT-2025-004',
    title: 'Nghiên cứu tác động của chuyển đổi số',
    status: 'APPROVED',
    sciDeptPriority: 'HIGH',
    sciDeptComment: 'Đề tài có tính thời sự cao',
    // ...
  },
  {
    code: 'ĐT-2025-005',
    title: 'Phân tích và dự báo biến động thị trường',
    status: 'REJECTED',
    unitApproved: false,
    unitComment: 'Đề tài thiếu tính khả thi',
    // ...
  },
  {
    code: 'ĐT-2025-006',
    title: 'Nghiên cứu phát triển vaccine thế hệ mới',
    level: 'NHA_NUOC',
    status: 'SUBMITTED',
    requestedBudgetTotal: 2500000000,
    // ...
  },
  {
    code: 'ĐT-2024-015',
    title: 'Đánh giá tác động của biến đổi khí hậu đến sản xuất lúa',
    year: 2024,
    status: 'APPROVED',
    sciDeptPriority: 'HIGH',
    // ...
  },
]
```

## 8. Yêu cầu

Hãy tạo đầy đủ:
1. Migration file cho bảng project_proposals
2. Model ProjectProposal với relationship to User
3. ProjectProposalsController
4. Routes
5. Validators (CreateProposalValidator, UpdateProposalValidator, UnitReviewValidator, SciDeptReviewValidator)
6. Seeder

## 9. Sau khi tạo xong, chạy:

```bash
# Chạy migration
node ace migration:run

# Chạy seeder
node ace db:seed
```
