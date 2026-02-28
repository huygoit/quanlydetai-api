Bạn là principal backend architect AdonisJS v6 (API-only).
Stack: TypeScript + Lucid ORM + PostgreSQL.

Mục tiêu:
Xây dựng KPI Engine FULL cho giờ NCKH theo Quyết định 1883/QĐ-ĐHSP,
bao phủ toàn bộ các nhóm kết quả (1–21) bằng kiến trúc rule-driven.

==================================================
⚠️ YÊU CẦU BẮT BUỘC — PUBLICATION PHẢI ĐÚNG TUYỆT ĐỐI
==================================================

Trong publications.rank chỉ có 4 giá trị:

ISI
SCOPUS
DOMESTIC
OTHER

KHÔNG ĐƯỢC hiểu rank là thứ hạng.

Mapping:

ISI     -> group = WOS
SCOPUS  -> group = SCOPUS
DOMESTIC/OTHER -> group = DOMESTIC_OTHER

quartile:

Q1..Q4 giữ nguyên  
null -> NO_Q

sub_type:

WOS_Q1
SCOPUS_Q2
DOMESTIC_OTHER

Lookup base_hours từ research_output_rules.

==================================================
⚠️ PUBLICATION FORMULA (PHẢI IMPLEMENT ĐÚNG)
==================================================

Let:

B0 = base_hours từ rule  
a_factor tính theo affiliation  
B = B0 * a_factor  

n = số tác giả chính (is_main_author=true)  
p = tổng số tác giả  

Main author:

hours = B/(3*n) + (2*B)/(3*p)

Co-author:

hours = (2*B)/(3*p)

Adjustments:

- nếu is_multi_affiliation_outside_udn = true → hours /= 2
- nếu giảng viên là nữ → hours *= 1.2

Engine phải validate:

- n >= 1
- p >= 1
- n <= p

==================================================
KIẾN TRÚC — STRATEGY PATTERN
==================================================

Tạo interface:

IKpiCalculatorStrategy

Methods:

- supports(output): boolean
- calculate(output, context): CalculationResult

==================================================
CÁC STRATEGY
==================================================

1. PublicationStrategy
   áp dụng cho publications

   Steps:

   - map rank → group
   - derive quartile
   - lookup rule
   - compute a_factor
   - compute B
   - split authors
   - apply multi-affiliation
   - apply female bonus

2. ProjectStrategy

   For project_proposals:

   Map acceptance_grade → c_factor:

   EXCELLENT = 1.1  
   PASS_ON_TIME = 1.0  
   PASS_LATE = 0.5  

   hours = base_hours * c_factor

   Nếu có nhiều người:

   - nếu có contribution_percent → chia theo %
   - else chia đều

3. BookStrategy

   hours = base_hours

   nếu có rule BONUS_HOURS → cộng thêm

   chia theo contribution_percent nếu có

4. PatentStrategy

   hours = base_hours  
   chia theo contribution_percent

5. TechnologyTransferStrategy

   xác định sub_type theo doanh thu  
   hours = base_hours

6. StudentResearchStrategy

   hours = base_hours theo level giải

7. SimpleFixedStrategy

   dùng cho:

   - Innovation
   - Awards
   - Art
   - Performance
   - Seminar

==================================================
KPI ENGINE SERVICE
==================================================

File:

app/Services/KpiEngineService.ts

Methods:

- calculateOutputHours(output)
- calculateTeacherKpi(profileId, academicYear)
- recalcAcademicYear(academicYear)

Flow:

1. load tất cả outputs của giảng viên trong academic_year
2. chọn strategy phù hợp
3. tính hours từng output
4. cộng dồn
5. quota mặc định = 600
6. met_quota = total >= quota

==================================================
API
==================================================

Controller:

app/Controllers/Http/KpisController.ts

Routes:

GET  /api/kpis/teachers/:profileId
GET  /api/kpis/teachers/:profileId?academic_year=YYYY-YYYY
GET  /api/kpis/publications/:id/breakdown
POST /api/kpis/recalculate

==================================================
CACHE
==================================================

Nếu có bảng kpi_results:

- upsert(profile_id, academic_year)
- lưu detail json

==================================================
WARNINGS SYSTEM (BẮT BUỘC)
==================================================

Engine phải trả warnings khi:

- missing rule
- publication chưa có authors
- n hoặc p invalid
- unknown rank
- thiếu quartile khi cần
- thiếu acceptance_grade
- DOMESTIC/OTHER chưa có rule

==================================================
PERFORMANCE
==================================================

- preload authors + profile
- batch load rules
- tránh N+1
- code TypeScript strict
- không viết frontend
- tương thích AdonisJS v6