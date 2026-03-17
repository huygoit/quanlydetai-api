You are working in an existing AdonisJS project using PostgreSQL.

Your job is to generate import code for Excel sheet/tab `SV_KhoiNghiep`.

First inspect the current codebase and reuse the existing schema/style/conventions.
Do not invent a different project structure.
Follow the existing folder naming, coding style, Lucid models, migrations, and Ace command patterns already used in this codebase.

## Existing context
The system already has or may already have:
- students
- lecturers
- faculties / departments / units
- projects table for research projects
- startup_projects
- startup_project_members
- research_startup_fields or an equivalent field/category table

Inspect the real schema first and adapt to actual names if they differ.

---

## Important business meaning of the Excel sheet

The Excel sheet is `SV_KhoiNghiep`.

Headers in the real file are:

- STT
- Tên dự án
- Thành viên dự án
- Khoa
- donvi_ma
- donvi_ten
- Vai trò
- Cố vấn (nếu có)
- Lĩnh vực
- Mô tả ngắn gọn các dự án
- Thành viên
- Năm

This sheet is grouped by startup project.

Important:
- one startup project spans multiple rows
- only the first row of a group may contain project-level fields such as:
  - Tên dự án
  - Cố vấn (nếu có)
  - Lĩnh vực
  - Mô tả ngắn gọn các dự án
- following rows often only contain member-level data such as:
  - Thành viên dự án
  - Vai trò
  - Khoa
  - donvi_ma
  - donvi_ten
  - Năm

Therefore:
- import logic must support carry-forward / fill-down for project-level fields
- if `Tên dự án` is empty, the row belongs to the most recent non-empty project above
- same idea for project-level fields like advisor, field, description, year when needed

Each row usually represents one member belonging to one startup project.

---

## Goal

Generate production-ready AdonisJS import code to import data from `SV_KhoiNghiep` into:

- `startup_projects`
- `startup_project_members`

If these tables do not exist yet in the codebase, generate the missing migration/model files too.
If they already exist, reuse them.

---

## Step 1: inspect existing schema

Inspect and adapt to the real schema of:

- startup_projects
- startup_project_members
- students
- lecturers
- faculties
- departments
- research_startup_fields (or equivalent)
- any unit/organization table related to donvi_ma / donvi_ten

If names differ, adapt generated code to the real schema.

---

## Step 2: if startup tables are missing, generate them

If `startup_projects` does not exist, generate PostgreSQL migration + Lucid model.

Suggested columns for `startup_projects`:
- id
- code (unique)
- title
- research_startup_field_id nullable
- faculty_id nullable
- department_id nullable
- unit_code nullable
- unit_name nullable
- leader_student_id nullable
- mentor_lecturer_id nullable
- academic_year nullable string or integer based on existing style
- status nullable
- problem_statement nullable
- solution_description nullable
- business_model nullable
- target_customer nullable
- product_stage nullable
- achievement nullable
- award_info nullable
- short_description nullable text
- note nullable
- is_active boolean default true
- created_at
- updated_at
- deleted_at nullable

If `startup_project_members` does not exist, generate PostgreSQL migration + Lucid model.

Suggested columns for `startup_project_members`:
- id
- startup_project_id references startup_projects.id on delete cascade
- member_type varchar indexed
  - STUDENT
  - LECTURER
- student_id nullable references students.id on delete set null
- lecturer_id nullable references lecturers.id on delete set null
- member_name nullable
- role varchar indexed
  - LEADER
  - MENTOR
  - MEMBER
- is_main boolean default false
- joined_at nullable date
- note nullable
- created_at
- updated_at

Use PostgreSQL partial unique indexes:
- unique(startup_project_id, student_id) where student_id is not null
- unique(startup_project_id, lecturer_id) where lecturer_id is not null

Add service-layer comments:
- if member_type = STUDENT => student_id should be filled when matched
- if member_type = LECTURER => lecturer_id should be filled when matched

---

## Step 3: generate import code

Generate these files:

1. `app/services/startup_project_import_service.ts`
2. `app/services/imports/startup_project_row_mapper.ts`
3. `app/services/imports/startup_project_header_resolver.ts`
4. `commands/ImportStartupProjects.ts`

Use package `xlsx` unless the project already uses another package for Excel import.

Support:
- `.xlsx`
- `.csv`

---

## Import behavior

### A. Read the `SV_KhoiNghiep` sheet
When reading xlsx:
- load sheet by exact name `SV_KhoiNghiep`

When reading csv:
- treat the whole file as one sheet

### B. Normalize and carry-forward project-level data
Rows belong to the current startup project until a new non-empty `Tên dự án` appears.

Implement logic like:
- keep a `currentProjectContext`
- when a row has non-empty `Tên dự án`, update current project context
- when a row has empty `Tên dự án`, inherit project fields from current project context

Carry forward these fields when needed:
- Tên dự án
- Cố vấn (nếu có)
- Lĩnh vực
- Mô tả ngắn gọn các dự án
- Năm
- donvi_ma
- donvi_ten
- Khoa

Do not carry forward member-specific fields:
- Thành viên dự án
- Vai trò

### C. Create/find startup project
For each normalized row:
- find startup project by priority:
  1. exact normalized title + year + donvi_ma
  2. otherwise title + year
- if not found, create startup project

Map fields:
- `Tên dự án` -> project title
- `Lĩnh vực` -> field/category
- `Mô tả ngắn gọn các dự án` -> short_description
- `donvi_ma` -> unit_code or matching unit relation if system has a unit table
- `donvi_ten` -> unit_name or related unit reference
- `Khoa` -> faculty/department matching if available
- `Năm` -> academic_year
- `Cố vấn (nếu có)` -> mentor lecturer if matched

If code is required and not provided by file, generate one safely.

### D. Resolve field/category
For `Lĩnh vực`:
- find in `research_startup_fields` or equivalent table
- only allow compatible types:
  - STARTUP
  - COMMON
- if not found and command option `--create-missing-fields` is passed:
  - create a new startup field
  - generate slug/code safely from the field name

### E. Resolve mentor/advisor
Header is: `Cố vấn (nếu có)`

If advisor exists:
- find lecturer by exact code if recognizable
- otherwise find by normalized name
- if found:
  - set `mentor_lecturer_id` on startup project when empty
  - also attach lecturer into startup_project_members with:
    - member_type = LECTURER
    - role = MENTOR
    - is_main = true
- avoid duplicate mentor attachment

If not found:
- log warning but do not fail import

### F. Resolve project member
Header is: `Thành viên dự án`

For each row:
- read member name from `Thành viên dự án`
- try to match student by normalized full name
- if system has student_code elsewhere, use that, but in this sheet there is no student_code column, so name matching is required
- try matching against students full_name / name fields already used by the codebase

If exactly one student is matched:
- attach into `startup_project_members` with:
  - member_type = STUDENT
  - student_id = matched student id
  - role mapped from `Vai trò`
- set is_main = true if role indicates leader/chủ nhiệm

If no student is matched:
- still create member record with:
  - member_type = STUDENT
  - student_id = null
  - member_name = raw name from sheet
  - role mapped from `Vai trò`
This is important to avoid losing member data when exact student matching fails.

If multiple students match:
- log warning
- prefer exact normalized full_name match
- if still ambiguous, create row with student_id = null and member_name = raw value

### G. Role normalization
Map `Vai trò` as:
- "Chủ nhiệm" => LEADER
- "Trưởng nhóm" => LEADER
- "Cố vấn" => MENTOR
- "Thành viên" => MEMBER
- otherwise default MEMBER

### H. Project status
If schema requires status, default imported startup project status to:
- APPROVED
or
- DRAFT
depending on the existing project convention found in the codebase

Prefer existing constants/enums already used in the project.

### I. Safe duplicate prevention
Import must be as idempotent as possible:
- avoid duplicate startup project creation
- avoid duplicate student member creation
- avoid duplicate lecturer mentor creation
- use partial unique indexes and upsert/findOrCreate logic appropriately

### J. Row safety
- do not fail the whole import because of one bad row
- process rows safely
- use transactions where appropriate
- log row-level errors and continue

### K. Summary output
At the end, print:
- total rows read
- normalized rows processed
- created projects
- updated projects
- attached student members
- attached lecturer mentors
- unmatched students
- unmatched lecturers
- created fields
- skipped rows
- warnings
- errors

---

## Header mapping
Implement flexible header alias mapping using the actual headers of this file.

Map:
- stt => ["STT", "stt"]
- project_title => ["Tên dự án", "ten du an"]
- member_name => ["Thành viên dự án", "thanh vien du an"]
- faculty_name => ["Khoa", "khoa"]
- unit_code => ["donvi_ma", "đơn vị mã"]
- unit_name => ["donvi_ten", "đơn vị tên"]
- role => ["Vai trò", "vai tro"]
- advisor_name => ["Cố vấn (nếu có)", "co van", "cố vấn"]
- field_name => ["Lĩnh vực", "linh vuc"]
- short_description => ["Mô tả ngắn gọn các dự án", "mo ta ngan gon cac du an"]
- member_list => ["Thành viên", "thanh vien"]
- year => ["Năm", "nam"]

Build helper methods that resolve values by aliases and normalize whitespace.

---

## Command
Create AdonisJS ace command:

`node ace import:startup-projects --file=/path/to/file.xlsx --sheet=SV_KhoiNghiep --create-missing-fields`

Requirements:
- support xlsx/csv
- use exact sheet name by default: `SV_KhoiNghiep`
- call the import service
- print readable summary

---

## PostgreSQL requirements
- use PostgreSQL-compatible migrations and SQL
- use partial unique indexes for nullable student_id / lecturer_id uniqueness
- do not use MySQL-specific syntax

---

## Output
Return code only, grouped by file.
Reuse actual existing schema after inspection.
Generate missing migrations/models only when necessary.
Keep code production-ready and consistent with this AdonisJS codebase.