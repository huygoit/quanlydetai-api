# Prompt 04: Scientific Profile Module (Hồ sơ khoa học)

Tôi cần bạn tạo API Hồ sơ khoa học cho hệ thống "Quản lý KH&CN" bằng AdonisJS + PostgreSQL.

## 1. Database Schema

### Bảng `scientific_profiles`
```sql
- id: bigint, PK
- user_id: bigint, FK to users, unique, not null

-- 1) Thông tin cá nhân
- full_name: varchar(255), not null
- date_of_birth: date, nullable
- gender: varchar(10), nullable -- 'Nam', 'Nữ', 'Khác'
- work_email: varchar(255), not null
- phone: varchar(20), nullable
- orcid: varchar(50), nullable
- google_scholar_url: text, nullable
- scopus_id: varchar(50), nullable
- research_gate_url: text, nullable
- personal_website: text, nullable
- avatar_url: text, nullable
- bio: text, nullable

-- 2) Công tác
- organization: varchar(255), not null
- faculty: varchar(255), nullable
- department: varchar(255), nullable
- current_title: varchar(100), nullable -- Chức danh: Giảng viên, GV chính, GV cao cấp
- management_role: varchar(100), nullable -- Chức vụ quản lý: Trưởng khoa, Phó khoa
- start_working_at: date, nullable

-- 3) Học hàm/học vị
- degree: varchar(20), nullable -- 'Cử nhân', 'Thạc sĩ', 'Tiến sĩ', 'Khác'
- academic_title: varchar(10), nullable -- 'Không', 'PGS', 'GS'
- degree_year: integer, nullable
- degree_institution: varchar(255), nullable
- degree_country: varchar(100), nullable

-- 4) Hướng nghiên cứu
- main_research_area: varchar(255), nullable
- sub_research_areas: jsonb, default '[]' -- array of strings
- keywords: jsonb, default '[]' -- array of strings

-- Meta
- status: varchar(20), default 'DRAFT' -- 'DRAFT', 'UPDATED', 'VERIFIED', 'NEED_MORE_INFO'
- completeness: integer, default 0 -- 0-100
- verified_at: timestamp, nullable
- verified_by: varchar(255), nullable
- need_more_info_reason: text, nullable
- created_at: timestamp
- updated_at: timestamp
```

### Bảng `profile_languages`
```sql
- id: bigint, PK
- profile_id: bigint, FK to scientific_profiles, on delete cascade
- language: varchar(50), not null
- level: varchar(20), nullable -- A1, A2, B1, B2, C1, C2, IELTS 7.0, etc.
- certificate: varchar(100), nullable
- certificate_url: text, nullable
- created_at: timestamp
- updated_at: timestamp
```

### Bảng `profile_attachments`
```sql
- id: bigint, PK
- profile_id: bigint, FK to scientific_profiles, on delete cascade
- type: varchar(20), not null -- 'CV_PDF', 'DEGREE', 'CERTIFICATE', 'OTHER'
- name: varchar(255), not null
- url: text, not null
- uploaded_at: timestamp
- created_at: timestamp
```

### Bảng `publications`
```sql
- id: bigint, PK
- profile_id: bigint, FK to scientific_profiles, on delete cascade
- title: varchar(500), not null
- authors: text, not null
- corresponding_author: varchar(255), nullable
- my_role: varchar(20), nullable -- 'CHU_TRI', 'DONG_TAC_GIA'
- publication_type: varchar(20), not null -- 'JOURNAL', 'CONFERENCE', 'BOOK_CHAPTER', 'BOOK'
- journal_or_conference: varchar(500), not null
- year: integer, nullable
- volume: varchar(20), nullable
- issue: varchar(20), nullable
- pages: varchar(50), nullable
- rank: varchar(20), nullable -- 'ISI', 'SCOPUS', 'DOMESTIC', 'OTHER'
- quartile: varchar(5), nullable -- 'Q1', 'Q2', 'Q3', 'Q4'
- doi: varchar(100), nullable
- issn: varchar(20), nullable
- isbn: varchar(20), nullable
- url: text, nullable
- publication_status: varchar(20), not null -- 'PUBLISHED', 'ACCEPTED', 'UNDER_REVIEW'
- source: varchar(20), default 'INTERNAL' -- 'INTERNAL', 'GOOGLE_SCHOLAR', 'SCV_DHDN'
- source_id: varchar(100), nullable
- verified_by_ncv: boolean, default false
- approved_internal: boolean, nullable
- attachment_url: text, nullable
- created_at: timestamp
- updated_at: timestamp
```

### Bảng `profile_verify_logs`
```sql
- id: bigint, PK
- profile_id: bigint, FK to scientific_profiles, on delete cascade
- action: varchar(20), not null -- 'VERIFY', 'REQUEST_MORE_INFO', 'CANCEL_VERIFY'
- note: text, nullable
- actor_role: varchar(20), not null -- 'PHONG_KH', 'ADMIN'
- actor_name: varchar(255), not null
- created_at: timestamp
```

## 2. API Endpoints

### Profile của bản thân (NCV)

#### GET /api/profile/me
Lấy hồ sơ của user hiện tại
Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 6,
    "fullName": "TS. Nguyễn Văn A",
    "dateOfBirth": "1985-03-15",
    "gender": "Nam",
    "workEmail": "nguyenvana@university.edu.vn",
    "phone": "0901234567",
    "orcid": "0000-0001-2345-6789",
    "googleScholarUrl": "https://scholar.google.com/...",
    "organization": "Trường ĐH Bách khoa - ĐHĐN",
    "faculty": "Khoa CNTT",
    "degree": "Tiến sĩ",
    "academicTitle": "Không",
    "mainResearchArea": "Công nghệ thông tin",
    "subResearchAreas": ["Machine Learning", "Deep Learning"],
    "keywords": ["AI", "Healthcare"],
    "status": "VERIFIED",
    "completeness": 95,
    "languages": [...],
    "attachments": [...],
    "publications": [...],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### POST /api/profile/me
Tạo hồ sơ mới cho user hiện tại (nếu chưa có)
Request:
```json
{
  "fullName": "string",
  "workEmail": "string",
  "organization": "string"
}
```

#### PUT /api/profile/me
Cập nhật hồ sơ
Request: (các field cần update)
```json
{
  "fullName": "string",
  "dateOfBirth": "1985-03-15",
  "gender": "Nam",
  "phone": "string",
  "orcid": "string",
  "organization": "string",
  "faculty": "string",
  "degree": "Tiến sĩ",
  "mainResearchArea": "Công nghệ thông tin",
  "subResearchAreas": ["ML", "DL"],
  "keywords": ["AI"]
}
```
- Tự động tính completeness sau khi update

#### POST /api/profile/me/submit
Gửi hồ sơ để xác thực (DRAFT/NEED_MORE_INFO → UPDATED)
- Gọi NotificationService.notifyProfileSubmitted()

### Languages sub-resource

#### GET /api/profile/me/languages
#### POST /api/profile/me/languages
Request:
```json
{
  "language": "Tiếng Anh",
  "level": "C1",
  "certificate": "IELTS 7.5",
  "certificateUrl": "..."
}
```
#### PUT /api/profile/me/languages/:id
#### DELETE /api/profile/me/languages/:id

### Attachments sub-resource

#### GET /api/profile/me/attachments
#### POST /api/profile/me/attachments
Request (multipart/form-data):
- file: File
- type: 'CV_PDF' | 'DEGREE' | 'CERTIFICATE' | 'OTHER'
- name: string

#### DELETE /api/profile/me/attachments/:id

### Publications sub-resource

#### GET /api/profile/me/publications
Query: `page`, `perPage`, `publicationType`, `rank`, `year`

#### POST /api/profile/me/publications
Request:
```json
{
  "title": "string",
  "authors": "Nguyen Van A, Tran B",
  "correspondingAuthor": "Nguyen Van A",
  "myRole": "CHU_TRI",
  "publicationType": "JOURNAL",
  "journalOrConference": "IEEE Transactions...",
  "year": 2023,
  "volume": "42",
  "issue": "8",
  "pages": "100-120",
  "rank": "ISI",
  "quartile": "Q1",
  "doi": "10.1109/...",
  "issn": "0278-0062",
  "publicationStatus": "PUBLISHED"
}
```

#### PUT /api/profile/me/publications/:id
#### DELETE /api/profile/me/publications/:id

### Danh sách hồ sơ (PHONG_KH, ADMIN)

#### GET /api/profiles
Query: `keyword`, `faculty`, `degree`, `mainResearchArea`, `status`, `page`, `perPage`
Response:
```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 100, "currentPage": 1, "perPage": 10, "lastPage": 10 }
}
```

#### GET /api/profiles/:id
Xem chi tiết hồ sơ bất kỳ

#### POST /api/profiles/:id/verify
Xác thực hồ sơ (PHONG_KH, ADMIN)
Request:
```json
{ "note": "Hồ sơ đầy đủ, đã kiểm tra bằng cấp." }
```
- Status → VERIFIED
- Gọi NotificationService.notifyProfileVerified()

#### POST /api/profiles/:id/request-more-info
Yêu cầu bổ sung (PHONG_KH, ADMIN)
Request:
```json
{ "note": "Cần bổ sung thông tin học vị và chứng chỉ ngoại ngữ." }
```
- Status → NEED_MORE_INFO
- Gọi NotificationService.notifyNeedMoreInfo()

#### GET /api/profiles/:id/verify-logs
Lịch sử xác thực hồ sơ

## 3. Business Logic

### Tính completeness score
```typescript
function calculateCompleteness(profile: ScientificProfile): number {
  let score = 0
  const checks = [
    { field: 'fullName', weight: 10 },
    { field: 'workEmail', weight: 10 },
    { field: 'organization', weight: 10 },
    { field: 'faculty', weight: 5 },
    { field: 'degree', weight: 10 },
    { field: 'mainResearchArea', weight: 10 },
    { field: 'bio', weight: 5 },
    { field: 'phone', weight: 5 },
    { field: 'orcid', weight: 5 },
    { field: 'googleScholarUrl', weight: 5 },
  ]

  checks.forEach(({ field, weight }) => {
    if (profile[field]) score += weight
  })

  // Languages: +10
  if (profile.languages?.length > 0) score += 10

  // Publications: +10
  if (profile.publications?.length > 0) score += 10

  // Max 100
  return Math.min(score, 100)
}
```

### Quyền truy cập
- NCV chỉ xem/sửa hồ sơ của mình
- PHONG_KH, ADMIN xem được tất cả, có quyền verify/request-more-info
- Khi verify/request-more-info → tạo ProfileVerifyLog và gửi notification

## 4. Seed Data

Tạo 5 profiles mẫu với đầy đủ languages, publications

## 5. Yêu cầu

Hãy tạo đầy đủ:
1. Migration files cho 5 bảng
2. Models với relationships (hasMany, belongsTo)
3. ProfileController (me endpoints)
4. ProfilesController (list, detail, verify endpoints)
5. ProfileLanguagesController
6. ProfileAttachmentsController  
7. PublicationsController
8. Routes
9. Validators
10. Seeder

## 6. Sau khi tạo xong, chạy:

```bash
# Chạy migration
node ace migration:run

# Chạy seeder
node ace db:seed
```
