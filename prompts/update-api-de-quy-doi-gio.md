Bạn là senior backend engineer AdonisJS v6 (API-only) + Lucid + PostgreSQL.

Bối cảnh routes hiện tại:
- /api/profile/me/publications: index/store/update/destroy (auth)
- /api/profiles: danh sách hồ sơ (PHONG_KH, ADMIN)
- /api/kpis/publications/:id/breakdown: đã có breakdown (auth)

Mục tiêu:
Bổ sung API để nhập đủ dữ liệu phục vụ “quy đổi giờ NCKH” (không dùng chữ KPI ở response UI labels).
Giữ nguyên routes hiện có, chỉ bổ sung route mới nếu thật cần.

========================
1) PUBLICATIONS (me) - bổ sung fields
========================
- Khi store/update publication (PublicationsController):
  - hỗ trợ academic_year (YYYY-YYYY)
  - hỗ trợ quartile gồm Q1..Q4 và NO_Q
  - rank giữ đúng enum: ISI | SCOPUS | DOMESTIC | OTHER
  - nếu rank in DOMESTIC/OTHER thì hỗ trợ:
      domestic_rule_type: 'HDGSNN_SCORE' | 'CONFERENCE_ISBN'
      hdgsnn_score: number (required if domestic_rule_type=HDGSNN_SCORE)

- Validate chặt chẽ:
  academic_year regex /^\d{4}-\d{4}$/
  rank in ['ISI','SCOPUS','DOMESTIC','OTHER']
  quartile in ['Q1','Q2','Q3','Q4','NO_Q']

========================
2) ADD AUTHORS SUB-RESOURCE ROUTES (me)
========================
Bổ sung routes dưới group /api/profile/me (middleware auth):

GET  /publications/:id/authors
PUT  /publications/:id/authors

Tạo controller mới: PublicationAuthorsController

- GET: trả danh sách publication_authors theo publication_id
- PUT: upsert array authors

Author payload fields:
- id? (optional)
- profile_id? (optional)
- full_name (required)
- author_order (required)
- is_main_author (required boolean)
- is_corresponding (required boolean)
- affiliation_type (required) in ['UDN_ONLY','MIXED','OUTSIDE']
- is_multi_affiliation_outside_udn (boolean)

Validation:
- p = number of authors >= 1
- n = count(is_main_author) >= 1
- n <= p
- unique author_order
- publication must belong to current user's profile (ownership check)

Upsert behavior:
- Update existing rows by id (must belong to this publication)
- Create new rows when id missing
- Delete rows that were removed from payload (soft delete optional; default hard delete)

========================
3) KpisController - giữ route hiện tại
========================
Giữ nguyên:
GET /api/kpis/publications/:id/breakdown

Nhưng cập nhật KpisController.publicationsBreakdown:
- load publication + publication_authors + linked scientific_profiles (gender)
- trả breakdown gồm:
  baseHours(B0), aFactor(a), totalHours(B), nMainAuthors, pTotalAuthors, perAuthorConvertedHours, warnings

Không thay route để frontend khỏi sửa nhiều.

========================
4) (Optional) Read-only for PHONG_KH/ADMIN
========================
Nếu trang profile/detail cần xem authors:
Bổ sung route trong /api/profiles group (PHONG_KH,ADMIN):

GET /api/profiles/:id/publications
GET /api/profiles/:id/publications/:pubId/authors

Hoặc ProfilesController.show trả kèm publications + authors (tuỳ kiến trúc hiện tại).

========================
OUTPUT
========================
- Update start/routes.ts: add 2 routes authors under /api/profile/me
- Create PublicationAuthorsController
- Update PublicationsController validators/store/update
- Update KpisController.publicationsBreakdown preload authors
- Provide request/response examples
- Không viết frontend