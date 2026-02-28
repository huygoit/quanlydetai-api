Bạn là senior backend engineer AdonisJS v6 + TypeScript.

Bối cảnh:
- Hệ thống đã có research_output_types (tree)
- Hệ thống đã có research_output_rules (canonical, FK type_id)
- Hiện KPI engine (kpi_engine_service.ts) vẫn đang lookup rules theo output_type/sub_type.

Mục tiêu:
Refactor engine để dùng kiến trúc mới dựa trên type_id (leaf).

==================================================
A) CREATE MAPPING SERVICE
==================================================

Tạo file:
app/Services/ResearchOutputMapperService.ts

Functions:

1) mapPublicationToTypeId(publication)

Logic:

IF publication.rank = 'ISI':
  map by quartile:
    Q1 -> leaf code 'PUB_WOS_Q1'
    Q2 -> 'PUB_WOS_Q2'
    Q3 -> 'PUB_WOS_Q3'
    Q4 -> 'PUB_WOS_Q4'
    NO_Q -> 'PUB_WOS_NO_Q'

IF publication.rank = 'SCOPUS':
  tương tự -> 'PUB_SCOPUS_Qx'

IF publication.rank in ('DOMESTIC','OTHER'):
  IF domestic_rule_type = 'HDGSNN_SCORE':
     -> 'PUB_DOMESTIC_HDGNN'
  IF domestic_rule_type = 'CONFERENCE_ISBN':
     -> 'PUB_CONF_ISBN'

Return: type_id by lookup code in research_output_types

2) mapProjectToTypeId(project)
(map theo level + acceptance_grade)

==================================================
B) UPDATE KPI ENGINE
==================================================

Trong kpi_engine_service.ts:

REPLACE toàn bộ logic lookup rule cũ bằng:

typeId = mapper.mapPublicationToTypeId(pub)

rule = await ResearchOutputRule
  .query()
  .where('type_id', typeId)
  .firstOrFail()

Sau đó tính hours theo rule_kind.

==================================================
C) REMOVE LEGACY LOOKUPS
==================================================

Search và xoá mọi chỗ:

- output_type
- sub_type
- base_hours hardcode
- research_output_rules legacy usage

==================================================
D) SAFETY
==================================================

Nếu map không ra type_id:
- throw error rõ ràng:
  "Không xác định được loại kết quả NCKH cho publication id=..."

==================================================
OUTPUT
==================================================

- ResearchOutputMapperService.ts
- Updated kpi_engine_service.ts
- Example mapping table
- No frontend