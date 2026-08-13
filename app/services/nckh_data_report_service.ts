import Publication from '#models/publication'
import ScientificProfile from '#models/scientific_profile'
import KpiEngineService from '#services/kpi_engine_service'
import NckhDataReportColumnConfigService, {
  type NckhDataColumnNode,
  type NckhDataColumnSelection,
  type NckhDataLeafColumn,
} from '#services/nckh_data_report_column_config_service'
import {
  publicationTrongKhoangKy,
  type KpiPeriodRange,
} from '#utils/kpi_period_helper'

const COLLATOR_VI = new Intl.Collator('vi', { sensitivity: 'base' })

function tachHoTen(fullName: string): { hoTenDem: string; ten: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { hoTenDem: '', ten: '' }
  if (parts.length === 1) return { hoTenDem: '', ten: parts[0] }
  const ten = parts[parts.length - 1]
  const hoTenDem = parts.slice(0, -1).join(' ')
  return { hoTenDem, ten }
}

export type NckhDataReportPayload = {
  academic_year: string
  period_from: string | null
  period_to: string | null
  period_label: string
  faculty: string
  generated_at: string
  faculties: string[]
  isDefaultAll: boolean
  selection: NckhDataColumnSelection
  columnTree: NckhDataColumnNode[]
  leafColumns: NckhDataLeafColumn[]
  rows: Array<{
    stt: number
    fullName: string
    hoTenDem: string
    ten: string
    hours: number
    note: string
    counts: Record<string, number>
  }>
  totals: { hours: number; counts: Record<string, number> }
}

/**
 * Ghép dữ liệu báo cáo Thống kê kết quả NCKH (cột theo cấu hình L1/L2/L3).
 */
export default class NckhDataReportService {
  static async build(params: {
    period: KpiPeriodRange | null
    periodLabel: string
    facultyParam: string
  }): Promise<NckhDataReportPayload> {
    const { period, periodLabel, facultyParam } = params

    const { selection, isDefaultAll, allTypes } =
      await NckhDataReportColumnConfigService.getSelection()
    const { columnTree, leafColumns } = NckhDataReportColumnConfigService.buildDisplayColumns(
      allTypes,
      selection
    )
    const leafIdSet = new Set(leafColumns.map((c) => c.id))

    const facultyRows = await ScientificProfile.query()
      .whereNotNull('faculty')
      .distinct('faculty')
      .select('faculty')
    const faculties = facultyRows
      .map((r) => (r.faculty || '').trim())
      .filter((f) => f.length > 0)
      .sort((a, b) => COLLATOR_VI.compare(a, b))

    const faculty = facultyParam || faculties[0] || ''
    const emptyTotals = () => {
      const counts: Record<string, number> = {}
      for (const leaf of leafColumns) counts[String(leaf.id)] = 0
      return { hours: 0, counts }
    }

    const base = {
      academic_year: periodLabel,
      period_from: period?.fromDate ?? null,
      period_to: period?.toDate ?? null,
      period_label: periodLabel,
      generated_at: new Date().toISOString(),
      faculties,
      isDefaultAll,
      selection,
      columnTree,
      leafColumns,
    }

    if (!faculty) {
      return {
        ...base,
        faculty: '',
        rows: [],
        totals: emptyTotals(),
      }
    }

    const profiles = await ScientificProfile.query()
      .where('faculty', faculty)
      .select('id', 'fullName')
    const profileIds = profiles.map((p) => Number(p.id))

    type RowState = {
      fullName: string
      hours: number
      note: string
      counts: Record<string, number>
    }
    const rowByProfile = new Map<number, RowState>()
    for (const p of profiles) {
      const counts: Record<string, number> = {}
      for (const leaf of leafColumns) counts[String(leaf.id)] = 0
      rowByProfile.set(Number(p.id), {
        fullName: p.fullName || '',
        hours: 0,
        note: '',
        counts,
      })
    }

    if (profileIds.length > 0) {
      const pubs = await Publication.query()
        .whereIn('profile_id', profileIds)
        .select('profileId', 'researchOutputTypeId', 'publishedAt', 'year')
      for (const pub of pubs) {
        const pid = pub.profileId != null ? Number(pub.profileId) : null
        if (pid == null) continue
        if (period && !publicationTrongKhoangKy(pub, period)) continue
        const row = rowByProfile.get(pid)
        if (!row) continue
        const typeId =
          pub.researchOutputTypeId != null ? Number(pub.researchOutputTypeId) : null
        if (typeId == null || !leafIdSet.has(typeId)) continue
        row.counts[String(typeId)] = (row.counts[String(typeId)] || 0) + 1
      }

      const hoursMap = await KpiEngineService.hoursByProfileForPeriod(period, profileIds)
      for (const [pid, hours] of hoursMap) {
        const row = rowByProfile.get(Number(pid))
        if (row) row.hours = Math.round((Number(hours) || 0) * 100) / 100
      }
    }

    const rows = Array.from(rowByProfile.values())
      .map((r) => {
        const { hoTenDem, ten } = tachHoTen(r.fullName)
        return { ...r, hoTenDem, ten }
      })
      .sort((a, b) => {
        const byTen = COLLATOR_VI.compare(a.ten, b.ten)
        if (byTen !== 0) return byTen
        return COLLATOR_VI.compare(a.hoTenDem, b.hoTenDem)
      })
      .map((r, i) => ({
        stt: i + 1,
        fullName: r.fullName,
        hoTenDem: r.hoTenDem,
        ten: r.ten,
        hours: r.hours,
        note: r.note,
        counts: r.counts,
      }))

    const totals = emptyTotals()
    for (const r of rows) {
      totals.hours += r.hours
      for (const leaf of leafColumns) {
        const key = String(leaf.id)
        totals.counts[key] = (totals.counts[key] || 0) + (r.counts[key] || 0)
      }
    }
    totals.hours = Math.round(totals.hours * 100) / 100

    return {
      ...base,
      faculty,
      rows,
      totals,
    }
  }
}
