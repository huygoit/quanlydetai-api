Bạn là senior backend engineer AdonisJS (v6) + Lucid + PostgreSQL.

Bối cảnh hệ thống (đã có):
- scientific_profiles
- publications
- project_proposals
- users

Hệ thống cần mở rộng để tính giờ NCKH theo Quyết định 1883/QĐ-ĐHSP.

YÊU CẦU QUAN TRỌNG:

Thiết kế schema theo hướng RULE-DRIVEN để bao phủ toàn bộ các nhóm kết quả NCKH (mục 1–21 của Bảng quy đổi), không hardcode trong code.

==================================================
PHẦN A — TABLE CHO TÁC GIẢ BÀI BÁO (đã xác định cần)
==================================================

Tạo bảng publication_authors:

- id bigserial pk
- publication_id bigint not null references publications(id) on delete cascade
- profile_id bigint references scientific_profiles(id) null
- full_name varchar(255) not null
- author_order int not null
- is_main_author boolean not null default false
- is_corresponding boolean not null default false
- affiliation_type varchar(20) not null default 'UDN_ONLY'
  check in ('UDN_ONLY','MIXED','OUTSIDE')
- is_multi_affiliation_outside_udn boolean not null default false
- contribution_percent numeric(5,2) null
- created_at timestamptz not null
- updated_at timestamptz not null

Indexes:
- index(publication_id)
- index(profile_id)
- unique(publication_id, author_order)

==================================================
PHẦN B — RULE ENGINE CHO TOÀN BỘ KẾT QUẢ NCKH
==================================================

Tạo bảng research_output_rules (trung tâm của hệ thống):

- id bigserial pk
- output_group varchar(50) not null
  // ví dụ:
  // PUBLICATION_WOS
  // PUBLICATION_SCOPUS
  // PUBLICATION_DOMESTIC
  // BOOK
  // PROJECT
  // PATENT
  // TECHNOLOGY_TRANSFER
  // STUDENT_RESEARCH
  // INNOVATION
  // AWARD
  // ART_WORK
  // PERFORMANCE
  // SEMINAR

- sub_type varchar(100) not null
  // ví dụ:
  // WOS_Q1
  // SCOPUS_Q2
  // BOOK_MONOGRAPH
  // PROJECT_NATIONAL_ACCEPTED
  // PATENT_GRANTED
  // ...

- rule_type varchar(30) not null
  check in (
    'FIXED_HOURS',      -- giờ cố định
    'MULTIPLY_SCORE',   -- giờ = hệ số * điểm
    'MULTIPLY_C',       -- giờ = base * c_factor
    'BONUS_HOURS',      -- cộng thêm giờ
    'PERCENT_SPLIT'     -- chia theo %
  )

- base_hours numeric(12,2) null
- score_multiplier numeric(12,4) null
- bonus_hours numeric(12,2) null

- min_value numeric(12,2) null
- max_value numeric(12,2) null

- description text null
- is_active boolean not null default true
- created_at timestamptz
- updated_at timestamptz

Unique:
- unique(output_group, sub_type)

==================================================
PHẦN C — EXTEND publications
==================================================

Alter publications:

ADD COLUMN academic_year varchar(9) null;

(giữ nguyên rank = ['ISI','SCOPUS','DOMESTIC','OTHER'])

==================================================
PHẦN D — EXTEND project_proposals
==================================================

Alter project_proposals:

ADD COLUMN academic_year varchar(9) null;

ADD COLUMN acceptance_grade varchar(20) null
  check in ('EXCELLENT','PASS_ON_TIME','PASS_LATE');

ADD COLUMN c_factor numeric(3,1) null;

==================================================
PHẦN E — TABLE CACHE KPI
==================================================

Tạo bảng kpi_results:

- id bigserial pk
- profile_id bigint not null references scientific_profiles(id) on delete cascade
- academic_year varchar(9) not null
- total_hours numeric(12,2) not null default 0
- met_quota boolean not null default false
- detail jsonb not null default '{}'::jsonb
- created_at timestamptz
- updated_at timestamptz

Unique:
- unique(profile_id, academic_year)

==================================================
PHẦN F — SEED FULL RULES (QUAN TRỌNG)
==================================================

Seed research_output_rules bao phủ toàn bộ nhóm trong Bảng 1.

1) PUBLICATION — WOS (ISI)

WOS_Q1 = 1800
WOS_Q2 = 1650
WOS_Q3 = 1500
WOS_Q4 = 1350
WOS_NO_Q = 1200

(rule_type = FIXED_HOURS)

2) PUBLICATION — SCOPUS / ESCI

SCOPUS_Q1 = 1500
SCOPUS_Q2 = 1350
SCOPUS_Q3 = 1200
SCOPUS_Q4 = 1050
SCOPUS_NO_Q = 900

(rule_type = FIXED_HOURS)

3) PUBLICATION_DOMESTIC

- DOMESTIC_HDGNN
  rule_type = MULTIPLY_SCORE
  score_multiplier = 600

- CONFERENCE_ISBN
  rule_type = FIXED_HOURS
  base_hours = 300

4) BOOK GROUP

Seed các subtype:

- BOOK_MONOGRAPH = 1500
- BOOK_REFERENCE = 900
- BOOK_EXERCISE = 600
- TRAINING_MATERIAL = 300
- TEXTBOOK_APPROVED = 1200
- TEXTBOOK_REPRINT = 360
- BOOK_INTL_PUBLISHER_BONUS
  rule_type = BONUS_HOURS
  bonus_hours = 300

5) SCIENTIFIC_REVIEW

- JOURNAL_REVIEW = 42

6) PROJECT GROUP

Seed theo mức:

- PROJECT_PROPOSAL_NATIONAL = 150
- PROJECT_PROPOSAL_MINISTRY = 120

- PROJECT_ACCEPTED_NATIONAL
  rule_type = MULTIPLY_C
  base_hours = 600

- PROJECT_ACCEPTED_MINISTRY
  rule_type = MULTIPLY_C
  base_hours = 450

- PROJECT_ACCEPTED_UNIVERSITY
  rule_type = MULTIPLY_C
  base_hours = 300

7) STUDENT_RESEARCH

Seed các mức 120 → 360 theo bảng.

8) PATENT / IP

Seed:

- PATENT_GRANTED = 1800
- UTILITY_GRANTED = 1200
- PATENT_VALID = 300
- UTILITY_VALID = 150

9) TECHNOLOGY_TRANSFER

Seed theo doanh thu:

- TRANSFER_LT_100 = 600
- TRANSFER_100_300 = 900
- TRANSFER_GT_300 = 1200

10) INNOVATION / STARTUP / AWARDS / ART / PERFORMANCE / SEMINAR

Seed đầy đủ theo bảng.

==================================================
PHẦN G — MODELS & RELATIONS
==================================================

Tạo Lucid models:

- PublicationAuthor
- ResearchOutputRule
- KpiResult

Update relations:

Publication:
  hasMany PublicationAuthor

ScientificProfile:
  hasMany PublicationAuthor
  hasMany KpiResult

==================================================
PHẦN H — OUTPUT YÊU CẦU
==================================================

Trả về:

1) Danh sách file migration cần tạo
2) Code đầy đủ từng migration
3) Code Lucid models
4) Seeder research_output_rules FULL
5) Không generate frontend
6) Tương thích AdonisJS v6 + PostgreSQL
7) Không phá dữ liệu cũ