# Prompt 06: Ideas Council Module (Hội đồng chấm điểm ý tưởng)

Tôi cần bạn tạo API Hội đồng chấm điểm ý tưởng cho hệ thống "Quản lý KH&CN" bằng AdonisJS + PostgreSQL.

Module này cho phép Phòng KH tạo phiên họp Hội đồng KH&ĐT để chấm điểm các ý tưởng đã sơ loại (status = APPROVED_INTERNAL).

## 1. Database Schema

### Bảng `council_sessions` (Phiên hội đồng)
```sql
- id: bigint, PK
- code: varchar(20), unique -- VD: HDYT-2024-01
- title: varchar(255), not null
- year: integer, not null
- meeting_date: date, nullable
- location: varchar(255), nullable
- status: varchar(20), default 'DRAFT' -- DRAFT, OPEN, CLOSED, PUBLISHED
- created_by_id: bigint, FK to users
- created_by_name: varchar(255)
- member_count: integer, default 0
- idea_count: integer, default 0
- note: text, nullable
- created_at: timestamp
- updated_at: timestamp
```

### Bảng `session_members` (Thành viên hội đồng trong phiên)
```sql
- id: bigint, PK
- session_id: bigint, FK to council_sessions, on delete cascade
- member_id: bigint, FK to users
- member_name: varchar(255), not null
- member_email: varchar(255), nullable
- role_in_council: varchar(20), not null -- CHU_TICH, THU_KY, UY_VIEN, PHAN_BIEN
- unit: varchar(255), nullable
- created_at: timestamp
```

### Bảng `session_ideas` (Ý tưởng trong phiên)
```sql
- id: bigint, PK
- session_id: bigint, FK to council_sessions, on delete cascade
- idea_id: bigint, FK to ideas
- idea_code: varchar(20), not null
- idea_title: varchar(500), not null
- owner_name: varchar(255), not null
- owner_unit: varchar(255), not null
- field: varchar(100), not null
- status_snapshot: varchar(30) -- Trạng thái ý tưởng tại thời điểm thêm vào
- created_at: timestamp
```

### Bảng `idea_council_scores` (Phiếu chấm điểm)
```sql
- id: bigint, PK
- session_id: bigint, FK to council_sessions, on delete cascade
- idea_id: bigint, FK to ideas
- council_member_id: bigint, FK to users
- council_member_name: varchar(255), not null
- council_role: varchar(20), not null

-- 4 tiêu chí chấm điểm (0-10)
- novelty_score: decimal(3,1), not null -- Tính mới (30%)
- novelty_comment: text
- feasibility_score: decimal(3,1), not null -- Tính khả thi (30%)
- feasibility_comment: text
- alignment_score: decimal(3,1), not null -- Phù hợp định hướng (20%)
- alignment_comment: text
- author_capacity_score: decimal(3,1), not null -- Năng lực tác giả (20%)
- author_capacity_comment: text

-- Điểm có trọng số (auto-calculated)
- weighted_score: decimal(4,2), not null
- general_comment: text, nullable

-- Trạng thái phiếu
- submitted: boolean, default false
- submitted_at: timestamp, nullable

- created_at: timestamp
- updated_at: timestamp
```

## 2. Công thức tính điểm

```typescript
// Trọng số các tiêu chí
const WEIGHTS = {
  novelty: 0.30,      // 30%
  feasibility: 0.30,  // 30%
  alignment: 0.20,    // 20%
  authorCapacity: 0.20 // 20%
}

// Tính điểm có trọng số
function calculateWeightedScore(scores: {
  novelty: number,
  feasibility: number,
  alignment: number,
  authorCapacity: number
}): number {
  const weighted = 
    scores.novelty * WEIGHTS.novelty +
    scores.feasibility * WEIGHTS.feasibility +
    scores.alignment * WEIGHTS.alignment +
    scores.authorCapacity * WEIGHTS.authorCapacity
  
  return Math.round(weighted * 100) / 100 // Làm tròn 2 chữ số
}

// Ngưỡng đề xuất đặt hàng
const THRESHOLD_SCORE = 7.0
```

## 3. API Endpoints

### Session APIs

#### GET /api/council-sessions
Query: `year`, `status`, `keyword`, `page`, `perPage`

#### GET /api/council-sessions/:id
Response bao gồm members và ideas

#### POST /api/council-sessions (PHONG_KH only)
Request:
```json
{
  "title": "Hội đồng chấm ý tưởng đợt 1/2024",
  "year": 2024,
  "meetingDate": "2024-03-15",
  "location": "Phòng họp A1",
  "note": "Đợt xét duyệt quý 1"
}
```
- Auto-generate code: HDYT-{year}-{sequence}
- Status = DRAFT

#### PUT /api/council-sessions/:id (PHONG_KH, only DRAFT)

#### POST /api/council-sessions/:id/open (PHONG_KH only)
- DRAFT → OPEN
- Điều kiện: memberCount > 0 và ideaCount > 0
- Sau khi mở, các thành viên hội đồng có thể chấm điểm

#### POST /api/council-sessions/:id/close (PHONG_KH only)
- OPEN → CLOSED
- **Tự động apply kết quả vào ideas:**
  - Với mỗi idea trong session, tính điểm trung bình
  - Nếu avgWeightedScore >= 7.0 → idea.status = PROPOSED_FOR_ORDER
  - Nếu avgWeightedScore < 7.0 → idea.status = REJECTED, rejectedStage = HOI_DONG_DE_XUAT
- Response:
```json
{
  "success": true,
  "data": { "proposedCount": 3, "rejectedCount": 1 }
}
```

#### POST /api/council-sessions/:id/publish (PHONG_KH only)
- CLOSED → PUBLISHED (công bố kết quả)

### Session Members APIs

#### GET /api/council-sessions/:id/members

#### POST /api/council-sessions/:id/members (PHONG_KH, only DRAFT)
Request:
```json
{
  "memberId": 3,
  "memberName": "PGS.TS Nguyễn Văn A",
  "memberEmail": "nva@email.com",
  "roleInCouncil": "CHU_TICH",
  "unit": "Khoa CNTT"
}
```
- Auto-update session.memberCount

#### DELETE /api/council-sessions/:id/members/:memberId (only DRAFT)
- Auto-update session.memberCount

### Session Ideas APIs

#### GET /api/council-sessions/:id/ideas

#### POST /api/council-sessions/:id/ideas (PHONG_KH, only DRAFT)
Request:
```json
{
  "ideas": [
    { "ideaId": 3 },
    { "ideaId": 6 }
  ]
}
```
- Chỉ cho phép thêm ideas có status = APPROVED_INTERNAL
- Tự động lấy ideaCode, ideaTitle, ownerName, ownerUnit, field từ idea
- Auto-update session.ideaCount

#### DELETE /api/council-sessions/:id/ideas/:sessionIdeaId (only DRAFT)
- Auto-update session.ideaCount

### Scoring APIs (HOI_DONG members)

#### GET /api/council-sessions/:sessionId/ideas/:ideaId/my-score
Lấy phiếu chấm của tôi cho 1 ý tưởng

#### POST /api/council-sessions/:sessionId/ideas/:ideaId/score
Lưu/cập nhật phiếu chấm (draft)
Request:
```json
{
  "noveltyScore": 8,
  "noveltyComment": "Ý tưởng mới, có tính đột phá",
  "feasibilityScore": 7,
  "feasibilityComment": "Có thể triển khai được",
  "alignmentScore": 9,
  "alignmentComment": "Rất phù hợp định hướng",
  "authorCapacityScore": 8,
  "authorCapacityComment": "Nhóm có kinh nghiệm",
  "generalComment": "Đề xuất thông qua"
}
```
- Điều kiện: session.status = OPEN
- Tự động tính weightedScore
- Nếu đã submitted thì không cho sửa

#### POST /api/council-sessions/:sessionId/scores/:scoreId/submit
Gửi phiếu chấm (không thể sửa sau khi gửi)
- Điều kiện: session.status = OPEN và chưa submitted

#### GET /api/council-sessions/:sessionId/ideas/:ideaId/scores (PHONG_KH, ADMIN)
Xem tất cả phiếu chấm cho 1 ý tưởng

### Aggregation APIs

#### GET /api/council-sessions/:sessionId/ideas/:ideaId/result
Kết quả tổng hợp cho 1 ý tưởng
Response:
```json
{
  "success": true,
  "data": {
    "sessionId": 1,
    "ideaId": 3,
    "ideaCode": "YT-2024-003",
    "ideaTitle": "Nghiên cứu giống lúa chịu hạn",
    "avgWeightedScore": 7.7,
    "avgNoveltyScore": 7.5,
    "avgFeasibilityScore": 7.5,
    "avgAlignmentScore": 8.5,
    "avgAuthorCapacityScore": 7.5,
    "submittedCount": 5,
    "memberCount": 5,
    "recommendation": "PROPOSE_ORDER",
    "thresholdScore": 7.0
  }
}
```

#### GET /api/council-sessions/:sessionId/results
Kết quả tất cả ý tưởng trong phiên

#### GET /api/council-sessions/:sessionId/stats
Thống kê chấm điểm
Response:
```json
{
  "success": true,
  "data": {
    "totalIdeas": 5,
    "totalMembers": 5,
    "totalExpectedScores": 25,
    "submittedScores": 20,
    "pendingScores": 5,
    "completionRate": 80
  }
}
```

## 4. Business Logic khi close session

```typescript
async function closeSession(sessionId: number) {
  const session = await CouncilSession.findOrFail(sessionId)
  
  // Get all session ideas
  const sessionIdeas = await SessionIdea.query().where('sessionId', sessionId)
  
  let proposedCount = 0
  let rejectedCount = 0
  
  for (const si of sessionIdeas) {
    // Get submitted scores for this idea
    const scores = await IdeaCouncilScore.query()
      .where('sessionId', sessionId)
      .where('ideaId', si.ideaId)
      .where('submitted', true)
    
    if (scores.length === 0) continue
    
    // Calculate averages
    const avgWeightedScore = scores.reduce((sum, s) => sum + s.weightedScore, 0) / scores.length
    const avgNoveltyScore = scores.reduce((sum, s) => sum + s.noveltyScore, 0) / scores.length
    // ... other averages
    
    const recommendation = avgWeightedScore >= 7.0 ? 'PROPOSE_ORDER' : 'NOT_PROPOSE'
    
    // Update idea with council results
    const idea = await Idea.findOrFail(si.ideaId)
    idea.councilSessionId = sessionId
    idea.councilAvgWeightedScore = avgWeightedScore
    idea.councilAvgNoveltyScore = avgNoveltyScore
    // ... other fields
    idea.councilRecommendation = recommendation
    idea.councilScoredAt = DateTime.now()
    
    if (recommendation === 'PROPOSE_ORDER') {
      idea.status = 'PROPOSED_FOR_ORDER'
      proposedCount++
    } else {
      idea.status = 'REJECTED'
      idea.rejectedStage = 'HOI_DONG_DE_XUAT'
      idea.rejectedReason = `Điểm trung bình ${avgWeightedScore.toFixed(2)}/10 không đạt ngưỡng 7.0`
      idea.rejectedByRole = 'HOI_DONG'
      idea.rejectedAt = DateTime.now()
      rejectedCount++
    }
    
    await idea.save()
    
    // Notify idea owner
    await NotificationService.notifyIdeaStatusChanged(
      idea.ownerId,
      idea.code,
      idea.status,
      idea.id
    )
  }
  
  session.status = 'CLOSED'
  await session.save()
  
  return { proposedCount, rejectedCount }
}
```

## 5. Seed Data

Tạo 1 session mẫu với 5 members và 2 ideas, có một vài scores:
```typescript
// Session
{ code: 'HDYT-2024-01', title: 'Hội đồng chấm ý tưởng đợt 1/2024', status: 'OPEN', ... }

// Members
[
  { memberName: 'PGS.TS Nguyễn Văn A', roleInCouncil: 'CHU_TICH', ... },
  { memberName: 'TS. Trần Thị B', roleInCouncil: 'THU_KY', ... },
  { memberName: 'PGS.TS Lê Văn C', roleInCouncil: 'PHAN_BIEN', ... },
  { memberName: 'TS. Phạm Văn D', roleInCouncil: 'UY_VIEN', ... },
  { memberName: 'TS. Hoàng Thị E', roleInCouncil: 'UY_VIEN', ... },
]

// Session Ideas (ideas có status APPROVED_INTERNAL)
[
  { ideaId: 3, ideaCode: 'YT-2024-003', ... },
  { ideaId: 6, ideaCode: 'YT-2024-006', ... },
]

// Scores (một vài phiếu mẫu)
[
  { ideaId: 3, councilMemberId: 1, noveltyScore: 8, ..., submitted: true },
  { ideaId: 3, councilMemberId: 3, noveltyScore: 7, ..., submitted: true },
]
```

## 6. Yêu cầu

Hãy tạo đầy đủ:
1. Migration files cho 4 bảng
2. Models với relationships
3. CouncilSessionsController
4. SessionMembersController  
5. SessionIdeasController
6. IdeaCouncilScoresController
7. Routes
8. Validators
9. Seeder

## 7. Sau khi tạo xong, chạy:

```bash
# Chạy migration
node ace migration:run

# Chạy seeder
node ace db:seed
```
