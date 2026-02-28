Bạn là senior backend engineer AdonisJS v6 + PostgreSQL.

Bối cảnh hiện tại:
- Đã có bảng: research_output_types (tree)
- Đã có bảng: research_output_type_rules (rule gắn theo type_id)
- Hiện còn tồn tại bảng research_output_rules cũ (legacy KPI) gây trùng tên/spec
- Tôi KHÔNG cần giữ dữ liệu cũ.

Mục tiêu:
Hợp nhất sạch:
- Chỉ còn 2 bảng:
  - research_output_types
  - research_output_rules (CANONICAL, gắn type_id)
- Xoá hẳn bảng legacy.
- Rename research_output_type_rules -> research_output_rules
- Update code để tất cả nơi dùng rules chỉ query research_output_rules mới.

==================================================
A) MIGRATION: DROP LEGACY + RENAME NEW
==================================================

Tạo migration mới, đảm bảo chạy an toàn theo thứ tự:

1) Nếu tồn tại bảng "research_output_rules" legacy:
   - DROP TABLE research_output_rules CASCADE;
   (vì không cần giữ data)

2) Nếu tồn tại bảng "research_output_type_rules":
   - RENAME TABLE research_output_type_rules TO research_output_rules;

3) (Optional) Ensure constraints/index đúng:
   - research_output_rules.type_id UNIQUE
   - FK type_id -> research_output_types.id ON DELETE CASCADE

Yêu cầu migration phải dùng hasTable để tránh fail nếu đã chạy một phần.

==================================================
B) UPDATE MODELS/QUERIES
==================================================

1) Model ResearchOutputRule phải trỏ tới bảng research_output_rules (canonical).
2) Xoá/không dùng model legacy.
3) Update mọi chỗ trong code đang import/Query bảng research_output_type_rules -> đổi sang ResearchOutputRule (canonical).

==================================================
C) UPDATE SERVICES (ENGINE) — BẮT BUỘC
==================================================

- Engine không được lookup theo output_type/sub_type nữa.
- Engine phải lookup theo type_id (leaf id của research_output_types).

Tạo helper mapping:

mapPublicationToTypeId(publication):
- rank ISI + quartile Q1..Q4/NO_Q -> leaf code 'WOS_Q1'.. (tuỳ seed)
- rank SCOPUS + quartile -> 'SCOPUS_Q1'..
- rank DOMESTIC/OTHER:
   - domestic_rule_type=HDGSNN_SCORE -> leaf 'DOMESTIC_HDGNN'
   - domestic_rule_type=CONFERENCE_ISBN -> leaf 'CONFERENCE_ISBN'

Sau đó:
rule = ResearchOutputRule.findBy('type_id', typeId)

==================================================
D) ROUTES/CONTROLLERS
==================================================

- Admin controllers hiện đang dùng research_output_type_rules: đổi sang research_output_rules
- Không đổi API routes, chỉ đổi model.

==================================================
E) OUTPUT
==================================================

Trả về code đầy đủ:
- migration
- updated model(s)
- updated services/queries references
- grep checklist: liệt kê các chỗ cần sửa (search for "research_output_type_rules" và "research_output_rules" legacy)