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
}

