import ProjectResearchHeaderResolver from '#services/imports/project_research_header_resolver'

export interface NormalizedResearchProjectRow {
  rowNumber: number
  code: string
  title: string
  leaderName: string
  leaderCode: string
  unitName: string
  unitCode: string
  budgetTotal: string
  startDate: string
  endDate: string
  isExtended: string
  extendedTime: string
  approvalStatus: string
  projectStatus: string
  acceptanceYear: string
}

export default class ProjectResearchRowMapper {
  static map(
    row: Record<string, unknown>,
    rowNumber: number,
    resolver: ProjectResearchHeaderResolver
  ): NormalizedResearchProjectRow | null {
    const normalized: NormalizedResearchProjectRow = {
      rowNumber,
      code: resolver.value(row, 'code'),
      title: resolver.value(row, 'title'),
      leaderName: resolver.value(row, 'leader_name'),
      leaderCode: resolver.value(row, 'leader_code'),
      unitName: resolver.value(row, 'unit_name'),
      unitCode: resolver.value(row, 'unit_code'),
      budgetTotal: resolver.value(row, 'budget_total'),
      startDate: resolver.value(row, 'start_date'),
      endDate: resolver.value(row, 'end_date'),
      isExtended: resolver.value(row, 'is_extended'),
      extendedTime: resolver.value(row, 'extended_time'),
      approvalStatus: resolver.value(row, 'approval_status'),
      projectStatus: resolver.value(row, 'project_status'),
      acceptanceYear: resolver.value(row, 'acceptance_year'),
    }

    if (!normalized.code && !normalized.title) return null
    return normalized
  }
}
