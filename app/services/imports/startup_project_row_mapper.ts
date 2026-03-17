import StartupProjectHeaderResolver from '#services/imports/startup_project_header_resolver'

export type NormalizedMemberRole = 'LEADER' | 'MENTOR' | 'MEMBER'

export interface StartupProjectContext {
  projectTitle: string
  advisorName: string
  fieldName: string
  shortDescription: string
  year: string
  unitCode: string
  unitName: string
  facultyName: string
}

export interface NormalizedStartupProjectRow {
  rowNumber: number
  stt: string
  projectTitle: string
  advisorName: string
  fieldName: string
  shortDescription: string
  year: string
  unitCode: string
  unitName: string
  facultyName: string
  memberName: string
  memberRole: NormalizedMemberRole
  memberList: string
}

function mapRole(rawRole: string): NormalizedMemberRole {
  const r = rawRole
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
  if (r.includes('chu nhiem') || r.includes('truong nhom')) return 'LEADER'
  if (r.includes('co van')) return 'MENTOR'
  return 'MEMBER'
}

export default class StartupProjectRowMapper {
  static createEmptyContext(): StartupProjectContext {
    return {
      projectTitle: '',
      advisorName: '',
      fieldName: '',
      shortDescription: '',
      year: '',
      unitCode: '',
      unitName: '',
      facultyName: '',
    }
  }

  static normalizeRow(
    row: Record<string, unknown>,
    rowNumber: number,
    resolver: StartupProjectHeaderResolver,
    current: StartupProjectContext
  ): { normalized: NormalizedStartupProjectRow | null; nextContext: StartupProjectContext } {
    const projectTitle = resolver.get(row, 'project_title') || current.projectTitle
    const advisorName = resolver.get(row, 'advisor_name') || current.advisorName
    const fieldName = resolver.get(row, 'field_name') || current.fieldName
    const shortDescription = resolver.get(row, 'short_description') || current.shortDescription
    const year = resolver.get(row, 'year') || current.year
    const unitCode = resolver.get(row, 'unit_code') || current.unitCode
    const unitName = resolver.get(row, 'unit_name') || current.unitName
    const facultyName = resolver.get(row, 'faculty_name') || current.facultyName
    const memberName = resolver.get(row, 'member_name')
    const memberRole = mapRole(resolver.get(row, 'role'))
    const stt = resolver.get(row, 'stt')
    const memberList = resolver.get(row, 'member_list')

    const nextContext: StartupProjectContext = {
      projectTitle,
      advisorName,
      fieldName,
      shortDescription,
      year,
      unitCode,
      unitName,
      facultyName,
    }

    if (!projectTitle && !memberName && !advisorName) {
      return { normalized: null, nextContext }
    }

    return {
      normalized: {
        rowNumber,
        stt,
        projectTitle,
        advisorName,
        fieldName,
        shortDescription,
        year,
        unitCode,
        unitName,
        facultyName,
        memberName,
        memberRole,
        memberList,
      },
      nextContext,
    }
  }
}
