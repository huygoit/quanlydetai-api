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
  note: string
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
  note: string
  memberName: string
  memberCode: string
  email: string
  role: ProjectMemberRole
}

function normalize(v: string): string {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
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
      note: '',
    }
  }

  static map(
    row: Record<string, unknown>,
    rowNumber: number,
    resolver: ProjectHeaderResolver,
    context: ProjectContext
  ): { nextContext: ProjectContext; normalized: NormalizedProjectRow | null } {
    const next: ProjectContext = {
      projectCode: resolver.value(row, 'project_code') || context.projectCode,
      projectTitle: resolver.value(row, 'project_title') || context.projectTitle,
      fieldName: resolver.value(row, 'field_name') || context.fieldName,
      academicYear: resolver.value(row, 'academic_year') || context.academicYear,
      year: resolver.value(row, 'year') || context.year,
      level: resolver.value(row, 'level') || context.level,
      status: resolver.value(row, 'status') || context.status,
      summary: resolver.value(row, 'summary') || context.summary,
      objectives: resolver.value(row, 'objectives') || context.objectives,
      expectedResults: resolver.value(row, 'expected_results') || context.expectedResults,
      budgetTotal: resolver.value(row, 'budget_total') || context.budgetTotal,
      startDate: resolver.value(row, 'start_date') || context.startDate,
      endDate: resolver.value(row, 'end_date') || context.endDate,
      leaderName: resolver.value(row, 'leader_name') || context.leaderName,
      leaderUnit: resolver.value(row, 'leader_unit') || context.leaderUnit,
      departmentName: resolver.value(row, 'department_name') || context.departmentName,
      note: resolver.value(row, 'note') || context.note,
    }

    const memberName = resolver.value(row, 'member_name')
    const memberCode = resolver.value(row, 'member_code')
    const email = resolver.value(row, 'email')
    const role = normalizeRole(resolver.value(row, 'role'))

    if (!next.projectTitle && !memberName && !memberCode && !email) {
      return { nextContext: next, normalized: null }
    }

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
        note: next.note,
        memberName,
        memberCode,
        email,
        role,
      },
    }
  }
}
