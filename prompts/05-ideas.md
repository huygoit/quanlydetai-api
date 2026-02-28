# Prompt 05: Ideas Module (Ngân hàng ý tưởng)

Tôi cần bạn tạo API Ngân hàng ý tưởng cho hệ thống "Quản lý KH&CN" bằng AdonisJS + PostgreSQL.

## 1. Database Schema

### Bảng `ideas`
```sql
- id: bigint, PK
- code: varchar(20), unique, not null -- VD: YT-2024-001
- title: varchar(500), not null
- summary: text, not null
- field: varchar(100), not null

-- Cấp đề tài phù hợp (multi-select, lưu dạng array)
- suitable_levels: jsonb, default '[]'
  -- Các giá trị: TRUONG_THUONG_NIEN, TRUONG_DAT_HANG, DAI_HOC_DA_NANG, 
  -- BO_GDDT, NHA_NUOC, NAFOSTED, TINH_THANH_PHO, DOANH_NGHIEP

-- Chủ sở hữu
- owner_id: bigint, FK to users, not null
- owner_name: varchar(255), not null
- owner_unit: varchar(255), not null

-- Trạng thái
- status: varchar(30), default 'DRAFT'
  -- DRAFT, SUBMITTED, REVIEWING, APPROVED_INTERNAL, 
  -- PROPOSED_FOR_ORDER, APPROVED_FOR_ORDER, REJECTED

-- Sơ loại
- priority: varchar(10), nullable -- LOW, MEDIUM, HIGH
- note_for_review: text, nullable

-- Thông tin từ chối
- rejected_stage: varchar(30), nullable 
  -- PHONG_KH_SO_LOAI, HOI_DONG_DE_XUAT, LANH_DAO_PHE_DUYET
- rejected_reason: text, nullable
- rejected_by_role: varchar(20), nullable -- PHONG_KH, HOI_DONG, LANH_DAO
- rejected_at: timestamp, nullable

-- Liên kết đề tài (sau khi khởi tạo)
- linked_project_id: varchar(50), nullable

-- Kết quả chấm điểm Hội đồng (sẽ cập nhật từ module ideas-council)
- council_session_id: bigint, nullable
- council_avg_weighted_score: decimal(4,2), nullable
- council_avg_novelty_score: decimal(4,2), nullable
- council_avg_feasibility_score: decimal(4,2), nullable
- council_avg_alignment_score: decimal(4,2), nullable
- council_avg_author_capacity_score: decimal(4,2), nullable
- council_submitted_count: integer, nullable
- council_member_count: integer, nullable
- council_recommendation: varchar(20), nullable -- PROPOSE_ORDER, NOT_PROPOSE
- council_scored_at: timestamp, nullable

- created_at: timestamp
- updated_at: timestamp
```

## 2. Workflow trạng thái

```
DRAFT → SUBMITTED → REVIEWING → APPROVED_INTERNAL → PROPOSED_FOR_ORDER → APPROVED_FOR_ORDER
         ↓              ↓                ↓                    ↓
      REJECTED      REJECTED          REJECTED            REJECTED
```

| Trạng thái | Mô tả | Ai chuyển |
|------------|-------|-----------|
| DRAFT | Bản nháp | NCV tạo |
| SUBMITTED | NCV đã gửi | NCV submit |
| REVIEWING | Phòng KH đang sơ loại | PHONG_KH receive |
| APPROVED_INTERNAL | Đã sơ loại (đạt) | PHONG_KH approve |
| PROPOSED_FOR_ORDER | HĐ đề xuất đặt hàng | HOI_DONG propose |
| APPROVED_FOR_ORDER | Lãnh đạo phê duyệt | LANH_DAO approve |
| REJECTED | Từ chối (kết thúc) | Bất kỳ role trên |

## 3. API Endpoints

### GET /api/ideas
Query params:
- `keyword`: tìm trong code, title, summary
- `field`: lĩnh vực
- `unit`: đơn vị
- `status`: trạng thái
- `suitableLevels[]`: cấp đề tài phù hợp (array)
- `priority`: độ ưu tiên
- `ownerId`: chỉ lấy của owner này
- `page`, `perPage`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "YT-2024-001",
      "title": "Ứng dụng AI trong chẩn đoán y tế",
      "summary": "...",
      "field": "Y học",
      "suitableLevels": ["BO_GDDT", "NHA_NUOC"],
      "ownerId": 6,
      "ownerName": "Nguyễn Văn A",
      "ownerUnit": "Khoa Y",
      "status": "SUBMITTED",
      "priority": "HIGH",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": { "total": 50, "currentPage": 1, "perPage": 10, "lastPage": 5 }
}
```

### GET /api/ideas/:id

Response (chi tiết đầy đủ):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "YT-2024-001",
    "title": "Ứng dụng AI trong chẩn đoán bệnh lý hình ảnh",
    "summary": "Nghiên cứu và phát triển hệ thống AI...",
    "field": "Y học",
    "suitableLevels": ["BO_GDDT", "NHA_NUOC"],
    "ownerId": 6,
    "ownerName": "Nguyễn Văn A",
    "ownerUnit": "Khoa Y",
    "status": "SUBMITTED",
    "priority": "HIGH",
    "noteForReview": "Ý tưởng rất tiềm năng",
    
    "rejectedStage": null,
    "rejectedReason": null,
    "rejectedByRole": null,
    "rejectedAt": null,
    
    "linkedProjectId": null,
    
    "councilSessionId": null,
    "councilAvgWeightedScore": null,
    "councilAvgNoveltyScore": null,
    "councilAvgFeasibilityScore": null,
    "councilAvgAlignmentScore": null,
    "councilAvgAuthorCapacityScore": null,
    "councilSubmittedCount": null,
    "councilMemberCount": null,
    "councilRecommendation": null,
    "councilScoredAt": null,
    
    "createdAt": "2024-01-15T08:00:00Z",
    "updatedAt": "2024-01-15T08:00:00Z"
  }
}
```

**Khi bị từ chối:**
```json
{
  "rejectedStage": "PHONG_KH_SO_LOAI",
  "rejectedReason": "Ý tưởng chưa khả thi do thiếu dữ liệu đầu vào",
  "rejectedByRole": "PHONG_KH",
  "rejectedAt": "2024-03-05T10:00:00Z"
}
```

**Khi đã có kết quả chấm điểm hội đồng:**
```json
{
  "councilSessionId": 1,
  "councilAvgWeightedScore": 7.5,
  "councilAvgNoveltyScore": 8.0,
  "councilAvgFeasibilityScore": 7.0,
  "councilAvgAlignmentScore": 7.5,
  "councilAvgAuthorCapacityScore": 7.5,
  "councilSubmittedCount": 5,
  "councilMemberCount": 5,
  "councilRecommendation": "PROPOSE_ORDER",
  "councilScoredAt": "2024-03-10T14:00:00Z"
}
```

### POST /api/ideas
Request:
```json
{
  "title": "Ứng dụng AI trong chẩn đoán y tế",
  "field": "Y học",
  "suitableLevels": ["BO_GDDT", "NHA_NUOC"],
  "summary": "Nghiên cứu và phát triển..."
}
```
- Auto-generate code: YT-{year}-{sequence}
- owner_id, owner_name, owner_unit từ current user
- status = DRAFT

### PUT /api/ideas/:id
- Chỉ cho phép khi status = DRAFT
- Chỉ owner

### DELETE /api/ideas/:id
- Chỉ cho phép khi status = DRAFT
- Chỉ owner

### POST /api/ideas/:id/submit
- DRAFT → SUBMITTED
- Chỉ owner
- Gọi AuditLogService.log()

### POST /api/ideas/:id/receive (PHONG_KH only)
- SUBMITTED → REVIEWING
- Gọi NotificationService.notifyIdeaStatusChanged()

### POST /api/ideas/:id/approve-internal (PHONG_KH only)
Request:
```json
{
  "priority": "HIGH",
  "noteForReview": "Ý tưởng rất tiềm năng"
}
```
- REVIEWING → APPROVED_INTERNAL
- Gọi NotificationService.notifyIdeaStatusChanged()

### POST /api/ideas/:id/propose-order (HOI_DONG only)
Request:
```json
{
  "priority": "HIGH",
  "noteForReview": "Đề xuất đặt hàng"
}
```
- APPROVED_INTERNAL → PROPOSED_FOR_ORDER
- **Lưu ý:** Endpoint này dùng cho manual propose. Thông thường sẽ qua module ideas-council.
- Gọi NotificationService.notifyIdeaStatusChanged()

### POST /api/ideas/:id/approve-order (LANH_DAO only)
Request:
```json
{
  "noteForReview": "Đồng ý đặt hàng"
}
```
- PROPOSED_FOR_ORDER → APPROVED_FOR_ORDER
- Gọi NotificationService.notifyIdeaStatusChanged()

### POST /api/ideas/:id/reject (PHONG_KH, HOI_DONG, LANH_DAO)
Request:
```json
{
  "rejectedReason": "Ý tưởng chưa khả thi do thiếu nguồn lực"
}
```
- Từ chối ở bất kỳ bước nào → REJECTED
- Tự động xác định rejectedStage dựa trên status hiện tại:
  - SUBMITTED/REVIEWING → PHONG_KH_SO_LOAI
  - APPROVED_INTERNAL → HOI_DONG_DE_XUAT
  - PROPOSED_FOR_ORDER → LANH_DAO_PHE_DUYET
- rejectedByRole từ current user role
- Gọi NotificationService.notifyIdeaStatusChanged()

### POST /api/ideas/:id/create-project (PHONG_KH, ADMIN)
- Điều kiện: status = APPROVED_FOR_ORDER
- Tạo linkedProjectId (mock: DT-{year}-{random})
Response:
```json
{
  "success": true,
  "data": {
    "ideaId": 1,
    "linkedProjectId": "DT-2024-001"
  }
}
```

### PUT /api/ideas/:id/council-result (Internal - được gọi từ ideas-council module)
Request:
```json
{
  "councilSessionId": 1,
  "councilAvgWeightedScore": 7.5,
  "councilAvgNoveltyScore": 8.0,
  "councilAvgFeasibilityScore": 7.0,
  "councilAvgAlignmentScore": 7.5,
  "councilAvgAuthorCapacityScore": 7.5,
  "councilSubmittedCount": 5,
  "councilMemberCount": 5,
  "councilRecommendation": "PROPOSE_ORDER"
}
```
- Cập nhật kết quả chấm điểm
- Nếu recommendation = PROPOSE_ORDER và score >= 7.0 → status = PROPOSED_FOR_ORDER
- Nếu recommendation = NOT_PROPOSE → status = REJECTED, rejectedStage = HOI_DONG_DE_XUAT

## 4. Helper: Generate Code

```typescript
async function generateIdeaCode(): Promise<string> {
  const year = new Date().getFullYear()
  const lastIdea = await Idea.query()
    .where('code', 'like', `YT-${year}-%`)
    .orderBy('id', 'desc')
    .first()
  
  let sequence = 1
  if (lastIdea) {
    const lastSeq = parseInt(lastIdea.code.split('-')[2])
    sequence = lastSeq + 1
  }
  
  return `YT-${year}-${String(sequence).padStart(3, '0')}`
}
```

## 5. Seed Data

Tạo 8 ideas mẫu với các status khác nhau:
```typescript
const ideas = [
  { code: 'YT-2024-001', title: 'Ứng dụng AI trong chẩn đoán y tế', status: 'SUBMITTED', ... },
  { code: 'YT-2024-002', title: 'Phát triển nền tảng học trực tuyến', status: 'REVIEWING', ... },
  { code: 'YT-2024-003', title: 'Nghiên cứu giống lúa chịu hạn', status: 'APPROVED_INTERNAL', ... },
  { code: 'YT-2024-004', title: 'Blockchain trong chuỗi cung ứng', status: 'DRAFT', ... },
  { code: 'YT-2024-005', title: 'Kinh tế tuần hoàn cho SMEs', status: 'APPROVED_FOR_ORDER', linkedProjectId: 'DT-2024-001', ... },
  { code: 'YT-2024-006', title: 'IoT giám sát thủy sản', status: 'PROPOSED_FOR_ORDER', ... },
  { code: 'YT-2024-007', title: 'ML dự báo chứng khoán', status: 'REJECTED', rejectedStage: 'PHONG_KH_SO_LOAI', ... },
  { code: 'YT-2024-008', title: 'Phần mềm quản lý bệnh viện', status: 'SUBMITTED', ... },
]
```

## 6. Yêu cầu

Hãy tạo đầy đủ:
1. Migration file cho bảng ideas
2. Model Idea với relationship to User
3. IdeasController
4. Routes
5. Validators (CreateIdeaValidator, UpdateIdeaValidator, RejectIdeaValidator)
6. Seeder

## 7. Sau khi tạo xong, chạy:

```bash
# Chạy migration
node ace migration:run

# Chạy seeder
node ace db:seed
```
