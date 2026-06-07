export interface TrendPoint {
  year: number
  researchProject: number
  studentResearch: number
  startup: number
}

export interface UnitStat {
  unit: string
  researchProject: number
  studentResearch: number
  startup: number
  total: number
}

export interface FieldStat {
  field: string
  researchProject: number
  studentResearch: number
  startup: number
  total: number
}

export interface DashboardAlert {
  key: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  description: string
}

/** Một nút gốc (level 1) trong cây loại kết quả NCKH. */
export interface RootOutputTypeStat {
  code: string
  name: string
  count: number
}

export interface ResearchOutputTypeNode {
  id: number
  parentId: number | null
  code: string
  name: string
  sortOrder?: number
}

export default class DashboardOverviewService {
  static buildRecentYears(currentYear: number, totalYears: number = 5): number[] {
    const start = currentYear - (totalYears - 1)
    return Array.from({ length: totalYears }, (_, i) => start + i)
  }

  static buildTrendMap(years: number[]): Map<number, TrendPoint> {
    const trend = new Map<number, TrendPoint>()
    for (const y of years) {
      trend.set(y, {
        year: y,
        researchProject: 0,
        studentResearch: 0,
        startup: 0,
      })
    }
    return trend
  }

  static mergeUnitStats(
    projectRows: Array<{ unit: string; research_project: string | number; student_research: string | number }>,
    startupRows: Array<{ unit: string; startup: string | number }>
  ): UnitStat[] {
    const map = new Map<string, UnitStat>()

    for (const row of projectRows) {
      const unit = row.unit || 'Chưa phân đơn vị'
      const current = map.get(unit) ?? {
        unit,
        researchProject: 0,
        studentResearch: 0,
        startup: 0,
        total: 0,
      }
      current.researchProject += Number(row.research_project ?? 0)
      current.studentResearch += Number(row.student_research ?? 0)
      current.total = current.researchProject + current.studentResearch + current.startup
      map.set(unit, current)
    }

    for (const row of startupRows) {
      const unit = row.unit || 'Chưa phân đơn vị'
      const current = map.get(unit) ?? {
        unit,
        researchProject: 0,
        studentResearch: 0,
        startup: 0,
        total: 0,
      }
      current.startup += Number(row.startup ?? 0)
      current.total = current.researchProject + current.studentResearch + current.startup
      map.set(unit, current)
    }

    return [...map.values()].sort((a, b) => b.total - a.total)
  }

  static mergeFieldStats(
    projectRows: Array<{ field: string; research_project: string | number; student_research: string | number }>,
    startupRows: Array<{ field: string; startup: string | number }>
  ): FieldStat[] {
    const map = new Map<string, FieldStat>()

    for (const row of projectRows) {
      const field = row.field || 'Chưa phân lĩnh vực'
      const current = map.get(field) ?? {
        field,
        researchProject: 0,
        studentResearch: 0,
        startup: 0,
        total: 0,
      }
      current.researchProject += Number(row.research_project ?? 0)
      current.studentResearch += Number(row.student_research ?? 0)
      current.total = current.researchProject + current.studentResearch + current.startup
      map.set(field, current)
    }

    for (const row of startupRows) {
      const field = row.field || 'Chưa phân lĩnh vực'
      const current = map.get(field) ?? {
        field,
        researchProject: 0,
        studentResearch: 0,
        startup: 0,
        total: 0,
      }
      current.startup += Number(row.startup ?? 0)
      current.total = current.researchProject + current.studentResearch + current.startup
      map.set(field, current)
    }

    return [...map.values()].sort((a, b) => b.total - a.total)
  }

  static buildAlerts(
    trend: TrendPoint[],
    unitStats: UnitStat[],
    fieldStats: FieldStat[]
  ): DashboardAlert[] {
    const alerts: DashboardAlert[] = []
    const latest = trend[trend.length - 1]
    const previous = trend[trend.length - 2]

    if (latest && previous) {
      const latestTotal = latest.researchProject + latest.studentResearch + latest.startup
      const previousTotal = previous.researchProject + previous.studentResearch + previous.startup
      if (latestTotal < previousTotal) {
        alerts.push({
          key: 'trend_drop',
          severity: 'MEDIUM',
          title: 'Xu hướng hoạt động giảm so với năm trước',
          description: `Tổng hoạt động năm ${latest.year} (${latestTotal}) thấp hơn năm ${previous.year} (${previousTotal}).`,
        })
      }
    }

    const weakUnits = unitStats.filter((u) => u.total <= 1).slice(0, 3)
    if (weakUnits.length > 0) {
      alerts.push({
        key: 'weak_units',
        severity: 'LOW',
        title: 'Đơn vị có hoạt động thấp',
        description: `Các đơn vị cần thúc đẩy thêm: ${weakUnits.map((u) => u.unit).join(', ')}.`,
      })
    }

    const weakFields = fieldStats.filter((f) => f.total <= 1).slice(0, 3)
    if (weakFields.length > 0) {
      alerts.push({
        key: 'weak_fields',
        severity: 'LOW',
        title: 'Lĩnh vực có hoạt động thấp',
        description: `Các lĩnh vực cần quan tâm: ${weakFields.map((f) => f.field).join(', ')}.`,
      })
    }

    return alerts
  }

  /** Từ id loại lá → loại gốc (parent_id null). */
  static resolveRootOutputType(
    typeId: number,
    typeById: Map<number, ResearchOutputTypeNode>
  ): { code: string; name: string } {
    let cur = typeById.get(typeId)
    if (!cur) {
      return { code: 'UNKNOWN', name: 'Chưa phân loại' }
    }
    while (cur.parentId != null) {
      const parent = typeById.get(cur.parentId)
      if (!parent) break
      cur = parent
    }
    return { code: cur.code, name: cur.name }
  }

  /** Gom số lượng publication theo loại gốc (I, II, III, …) — luôn trả đủ loại gốc, thiếu thì count = 0. */
  static aggregatePublicationsByRootType(
    countRows: Array<{ research_output_type_id: number | null; total: string | number }>,
    typeById: Map<number, ResearchOutputTypeNode>,
    rootTypes: ResearchOutputTypeNode[] = []
  ): RootOutputTypeStat[] {
    const map = new Map<string, RootOutputTypeStat>()

    for (const root of rootTypes) {
      map.set(root.code, { code: root.code, name: root.name, count: 0 })
    }

    for (const row of countRows) {
      const typeId = row.research_output_type_id
      const root =
        typeId == null
          ? { code: 'UNCLASSIFIED', name: 'Chưa phân loại' }
          : this.resolveRootOutputType(typeId, typeById)
      const current = map.get(root.code) ?? { code: root.code, name: root.name, count: 0 }
      current.count += Number(row.total ?? 0)
      map.set(root.code, current)
    }

    const rootOrder = new Map(rootTypes.map((r, i) => [r.code, r.sortOrder ?? i]))
    return [...map.values()].sort((a, b) => {
      const orderA = rootOrder.get(a.code)
      const orderB = rootOrder.get(b.code)
      if (orderA != null && orderB != null) return orderA - orderB
      if (orderA != null) return -1
      if (orderB != null) return 1
      return b.count - a.count
    })
  }
}

