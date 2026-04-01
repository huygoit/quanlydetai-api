import ProjectHeaderResolver from '#services/imports/project_header_resolver'

export type ProjectMemberRole = 'LEADER' | 'SUPERVISOR' | 'MEMBER' | 'SECRETARY'
export type ProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'AWARDED'
  | 'REJECTED'
  | 'CANCELLED'

export interface ProjectContext {
  projectCode: string
  projectTitle: string
  fieldName: string
  academicYear: string
  year: string
  level: string
  status: string
  summary: string
  objectives: string
  expectedResults: string
  budgetTotal: string
  startDate: string
  endDate: string
  leaderName: string
  leaderUnit: string
  departmentName: string
  /** Mã đơn vị (vd donvi_ma) — map departments.code */
  departmentCode: string
  note: string
}

/** Tuỳ chọn map dòng — SV NCKH: gom đề theo cột Detai_name (distinct), không lấy Tên đề tài làm nhóm */
export interface ProjectRowMapOptions {
  groupByDetaiName?: boolean
}

export interface NormalizedProjectRow {
  rowNumber: number
  projectCode: string
  projectTitle: string
  fieldName: string
  academicYear: string
  year: string
  level: string
  status: ProjectStatus
  summary: string
  objectives: string
  expectedResults: string
  budgetTotal: string
  startDate: string
  endDate: string
  leaderName: string
  leaderUnit: string
  departmentName: string
  departmentCode: string
  note: string
  memberName: string
  memberCode: string
  email: string
  role: ProjectMemberRole
  /**
   * Khóa gộp đề SV NCKH: chỉ Detai (đã gộp theo dòng) + năm — “gộp trùng tên”: cùng chuỗi Detai_name (sau chuẩn hoá) + cùng năm = một đề,
   * nhiều dòng thành viên (SV/nhóm khác nhau) cùng khóa. Không ghép thêm đơn vị vào khóa để tránh tách một đề thành nhiều project khi donvi lệch dòng.
   */
  studentResearchIdentityKey?: string
}

function normalize(v: string): string {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/** Khóa so sánh “cùng một Detai_name” (distinct): gộp khoảng trắng + bỏ dấu — khớp logic normalizeText bên import */
function normalizeGroupKey(v: string): string {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Chuẩn hoá tên cột giống ProjectHeaderResolver để khớp alias với header Excel */
function normalizeHeaderKey(v: string): string {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Đọc ô theo danh sách tên cột có thể có — dùng khi resolver chỉ gắn một cột
 * (vd map department_name → donvi_name trong khi nhiều dòng chỉ có donvi_cu).
 */
function rowValueByHeaderAliases(row: Record<string, unknown>, aliases: string[]): string {
  const normToKey = new Map<string, string>()
  for (const k of Object.keys(row)) {
    const nk = normalizeHeaderKey(k)
    if (!normToKey.has(nk)) normToKey.set(nk, k)
  }
  for (const alias of aliases) {
    const key = normToKey.get(normalizeHeaderKey(alias))
    if (!key) continue
    const raw = row[key]
    if (raw === undefined || raw === null) continue
    const s = String(raw).replace(/\s+/g, ' ').trim()
    if (s !== '') return s
  }
  return ''
}

function normalizeRole(raw: string): ProjectMemberRole {
  const r = normalize(raw)
  if (!r) return 'MEMBER'
  if (r.includes('chu nhiem') || r.includes('truong nhom')) return 'LEADER'
  if (r.includes('giang vien huong dan') || r.includes('huong dan')) return 'SUPERVISOR'
  if (r.includes('thu ky')) return 'SECRETARY'
  if (r.includes('thanh vien')) return 'MEMBER'
  return 'MEMBER'
}

/**
 * Gộp chuỗi Detai_name giữa dòng hiện tại và context: cùng nhóm distinct nếu khóa chuẩn hoá trùng hoặc một chuỗi là prefix (Excel cắt ô).
 */
function mergeCarriedProjectTitle(titleFromRow: string, contextTitle: string): string {
  const a = String(titleFromRow || '')
    .replace(/\s+/g, ' ')
    .trim()
  const b = String(contextTitle || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!a) return b
  if (!b) return a
  const na = normalizeGroupKey(a)
  const nb = normalizeGroupKey(b)
  if (na === nb) return a.length >= b.length ? a : b
  if (nb.startsWith(na) || na.startsWith(nb)) return a.length >= b.length ? a : b
  return a
}

function normalizeStatus(raw: string): ProjectStatus {
  const s = normalize(raw)
  if (!s) return 'DRAFT'
  if (s.includes('submitted') || s.includes('da gui')) return 'SUBMITTED'
  if (s.includes('approved') || s.includes('duyet')) return 'APPROVED'
  if (s.includes('in_progress') || s.includes('dang thuc hien')) return 'IN_PROGRESS'
  if (s.includes('completed') || s.includes('hoan thanh')) return 'COMPLETED'
  if (s.includes('awarded') || s.includes('dat giai')) return 'AWARDED'
  if (s.includes('rejected') || s.includes('tu choi')) return 'REJECTED'
  if (s.includes('cancelled') || s.includes('huy')) return 'CANCELLED'
  return 'DRAFT'
}

export default class ProjectRowMapper {
  static emptyContext(): ProjectContext {
    return {
      projectCode: '',
      projectTitle: '',
      fieldName: '',
      academicYear: '',
      year: '',
      level: '',
      status: '',
      summary: '',
      objectives: '',
      expectedResults: '',
      budgetTotal: '',
      startDate: '',
      endDate: '',
      leaderName: '',
      leaderUnit: '',
      departmentName: '',
      departmentCode: '',
      note: '',
    }
  }

  static map(
    row: Record<string, unknown>,
    rowNumber: number,
    resolver: ProjectHeaderResolver,
    context: ProjectContext,
    options?: ProjectRowMapOptions
  ): { nextContext: ProjectContext; normalized: NormalizedProjectRow | null } {
    const groupByDetai = options?.groupByDetaiName === true
    const rawDetai = rowValueByHeaderAliases(row, ['Detai_name', 'detai_name'])

    // SV NCKH: DISTINCT theo (Detai_name đã gộp + năm) — trùng tên = một đề dù nhiều dòng thành viên; đơn vị không tham gia khóa gộp.
    let titleFromRow = groupByDetai
      ? rawDetai
      : resolver.value(row, 'project_title') || rawDetai

    if (groupByDetai && !titleFromRow && !context.projectTitle) {
      titleFromRow = resolver.value(row, 'project_title')
    }

    const mergedTitle = mergeCarriedProjectTitle(titleFromRow, context.projectTitle)
    const yearFromRow =
      resolver.value(row, 'year') || rowValueByHeaderAliases(row, ['năm', 'nam', 'year'])
    const leaderFromRow = resolver.value(row, 'leader_name')

    const explicitDetaiOnRow = Boolean(rawDetai)

    // Không kéo GVHD sang đề tài / khối năm mới khi dòng có tiêu đề hoặc năm mới rõ ràng mà cột GVHD trống (sheet 2026 thường bỏ trống cột Người hướng dẫn).
    let nextLeader = context.leaderName
    if (leaderFromRow) {
      nextLeader = leaderFromRow
    } else if (
      (groupByDetai ? explicitDetaiOnRow : Boolean(titleFromRow)) &&
      context.projectTitle &&
      normalizeGroupKey(mergedTitle) !== normalizeGroupKey(context.projectTitle)
    ) {
      nextLeader = ''
    } else if (yearFromRow && context.year && yearFromRow !== context.year) {
      nextLeader = ''
    }

    const next: ProjectContext = {
      projectCode: resolver.value(row, 'project_code') || context.projectCode,
      projectTitle: mergedTitle,
      fieldName: resolver.value(row, 'field_name') || context.fieldName,
      academicYear: resolver.value(row, 'academic_year') || context.academicYear,
      year: yearFromRow || context.year,
      level: resolver.value(row, 'level') || context.level,
      status: resolver.value(row, 'status') || context.status,
      summary: resolver.value(row, 'summary') || context.summary,
      objectives: resolver.value(row, 'objectives') || context.objectives,
      expectedResults: resolver.value(row, 'expected_results') || context.expectedResults,
      budgetTotal: resolver.value(row, 'budget_total') || context.budgetTotal,
      startDate: resolver.value(row, 'start_date') || context.startDate,
      endDate: resolver.value(row, 'end_date') || context.endDate,
      leaderName: nextLeader,
      leaderUnit: resolver.value(row, 'leader_unit') || context.leaderUnit,
      departmentName:
        resolver.value(row, 'department_name') ||
        rowValueByHeaderAliases(row, ['donvi_cu']) ||
        context.departmentName,
      departmentCode:
        resolver.value(row, 'department_code') ||
        rowValueByHeaderAliases(row, ['donvi_ma']) ||
        context.departmentCode,
      note: resolver.value(row, 'note') || context.note,
    }

    const memberName = resolver.value(row, 'member_name')
    const memberCode = resolver.value(row, 'member_code')
    const email = resolver.value(row, 'email')
    const role = normalizeRole(resolver.value(row, 'role'))

    if (!next.projectTitle && !memberName && !memberCode && !email) {
      return { nextContext: next, normalized: null }
    }

    const effectiveYear = String(next.year || '').trim()
    const studentResearchIdentityKey =
      groupByDetai && next.projectTitle && effectiveYear
        ? `${normalizeGroupKey(next.projectTitle)}\x1F${effectiveYear}`
        : undefined

    return {
      nextContext: next,
      normalized: {
        rowNumber,
        projectCode: next.projectCode,
        projectTitle: next.projectTitle,
        fieldName: next.fieldName,
        academicYear: next.academicYear,
        year: next.year,
        level: next.level,
        status: normalizeStatus(next.status),
        summary: next.summary,
        objectives: next.objectives,
        expectedResults: next.expectedResults,
        budgetTotal: next.budgetTotal,
        startDate: next.startDate,
        endDate: next.endDate,
        leaderName: next.leaderName,
        leaderUnit: next.leaderUnit,
        departmentName: next.departmentName,
        departmentCode: next.departmentCode,
        note: next.note,
        memberName,
        memberCode,
        email,
        role,
        studentResearchIdentityKey,
      },
    }
  }
}
