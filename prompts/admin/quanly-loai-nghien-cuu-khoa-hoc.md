Bạn là senior backend engineer AdonisJS v6 (API-only) + TypeScript + Lucid ORM + PostgreSQL.

Mục tiêu:
Xây dựng module ADMIN quản lý “Loại kết quả NCKH” theo cây phân cấp (2–3 cấp).
Mỗi leaf node có rule quy đổi gồm “điểm quy đổi” và “giờ NCKH quy đổi” (có loại cố định, có loại theo công thức).

⚠️ Đây là API cho admin, KHÔNG làm frontend.

==================================================
A) DATABASE MIGRATIONS
==================================================

1) Table: research_output_types
- id bigserial pk
- parent_id bigint nullable fk -> research_output_types.id (on delete restrict)
- code varchar(50) not null unique
- name varchar(255) not null
- level smallint not null (1..3)  // enforce
- sort_order int not null default 0
- is_active boolean not null default true
- note text nullable
- timestamps

Indexes:
- parent_id
- (parent_id, sort_order)

Constraints:
- level in (1,2,3)
- parent_id null only when level=1
- if level>1 parent_id not null

2) Table: research_output_rules
- id bigserial pk
- type_id bigint not null unique fk -> research_output_types.id (on delete cascade)
- rule_kind varchar(50) not null
- points_value numeric(10,2) nullable
- hours_value numeric(10,2) nullable
- hours_multiplier_var varchar(10) nullable  // e.g. 'a', 'c'
- hours_bonus numeric(10,2) nullable
- meta jsonb not null default '{}'::jsonb
- evidence_requirements text nullable
- timestamps

Enum rule_kind (validate in code):
- FIXED
- MULTIPLY_A
- HDGSNN_POINTS_TO_HOURS
- MULTIPLY_C
- RANGE_REVENUE
- BONUS_ADD

==================================================
B) MODELS & RELATIONS
==================================================

Model ResearchOutputType:
- self-relation: parent, children
- hasOne: rule

Model ResearchOutputRule:
- belongsTo: type

Computed helpers:
- isLeaf(): boolean (no children)
- canHaveRule(): only leaf

==================================================
C) VALIDATION RULES
==================================================

1) Max depth = 3
- create/update: prevent setting parent that would exceed level 3
- prevent cycle (parent cannot be itself or its descendants)

2) Delete:
- If node has children -> return 409 with message "Không thể xoá vì còn node con"
  (optional: support cascade delete via query ?cascade=1)

3) Rule upsert:
- Only allow for leaf nodes (children count = 0), else 400
- Validate fields by rule_kind:

FIXED:
- points_value required
- hours_value required

MULTIPLY_A:
- points_value required
- hours_value required (base hours trước khi nhân a)
- hours_multiplier_var must be 'a'

HDGSNN_POINTS_TO_HOURS:
- points_value nullable (vì lấy điểm HĐGSNN động)
- hours_value must be 600 (hệ số)
- meta must include { "source": "HDGSNN", "hours_per_point": 600 }

MULTIPLY_C:
- points_value required (base points)
- hours_value required (base hours)
- hours_multiplier_var must be 'c'
- meta must include mapping c:
  { "c_map": { "EXCELLENT":1.1, "PASS_ON_TIME":1.0, "PASS_LATE":0.5 } }

RANGE_REVENUE:
- meta must include ranges:
  { "ranges":[
     {"min":0,"max":100000000,"points":1.0,"hours":600},
     {"min":100000000,"max":300000000,"points":1.5,"hours":900},
     {"min":300000000,"max":null,"points":2.0,"hours":1200}
  ]}

BONUS_ADD:
- points_value required
- hours_value required
- hours_bonus required
- meta can include { "bonus_condition": "NXB uy tín WoS/Scopus" }

==================================================
D) ROUTES (ADMIN)
==================================================

Add to start/routes.ts under /api/admin (middleware auth + role ADMIN/PHONG_KH):

GET    /research-output-types/tree
POST   /research-output-types
PUT    /research-output-types/:id
DELETE /research-output-types/:id
PUT    /research-output-types/:id/move

Rule:
GET    /research-output-types/:id/rule
PUT    /research-output-types/:id/rule

==================================================
E) CONTROLLERS
==================================================

1) AdminResearchOutputTypesController
- tree(): return nested tree sorted by sort_order
  Response node shape:
  { id, code, name, level, sortOrder, isActive, hasRule, children: [] }

- store(): create node
- update(): update node
- destroy(): delete with child check
- move(): payload { new_parent_id|null, new_sort_order }
  - recalc level based on parent (level=parent.level+1)
  - validate max depth + no cycle
  - update sort_order

2) AdminResearchOutputRulesController
- show(): return rule for type_id
- upsert(): create/update rule for leaf
  - ensure leaf
  - validate by rule_kind

==================================================
F) SERVICE LAYER
==================================================

Create:
app/Services/ResearchOutputTypeService.ts
- getTree()
- assertNoCycle(typeId, newParentId)
- computeLevel(newParentId)
- isLeaf(typeId)

Create:
app/Services/ResearchOutputRuleValidator.ts
- validateByKind(payload)

==================================================
G) SEED (OPTIONAL BUT RECOMMENDED)
==================================================

Create seeder to import initial tree from Phụ lục:
- Level 1: I..V
- Level 2: 1..21
- Level 3: 1.1.., 2.1.., 6.1.., 8.1.., 9.1.., 10.1.., 11.1.., 12.1.., 13.1.., 14.1.., 15.1.., 18.1.., 19.1.., 20.1.., 21.1..
- Attach rules at leaf with rule_kind + points/hours/meta.

Seeder name:
database/seeders/ResearchOutputTypesSeeder.ts

==================================================
OUTPUT
==================================================

Trả về code đầy đủ:
- migrations
- models
- validators
- routes snippet
- controllers
- services
- seeder (nếu làm)
- sample request/response JSON
Không viết frontend.