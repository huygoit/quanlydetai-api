import { DateTime } from 'luxon'
import type Publication from '#models/publication'
import type ProjectProposal from '#models/project_proposal'

/** Tháng bắt đầu năm tài chính (khớp FE). */
export const THANG_BAT_DAU_NAM_TAI_CHINH = 4

export type KpiPeriodRange = {
  from: DateTime
  to: DateTime
  fromDate: string
  toDate: string
}

export function namThamChieuNamTaiChinh(ref = DateTime.local()): number {
  const m = ref.month
  if (m >= THANG_BAT_DAU_NAM_TAI_CHINH) return ref.year
  return ref.year - 1
}

/** Khoảng năm tài chính: 01/04/refYear → 31/03/(refYear+1). */
export function khoangNamTaiChinh(refYear?: number): KpiPeriodRange {
  const y = refYear ?? namThamChieuNamTaiChinh()
  const from = DateTime.fromObject({ year: y, month: THANG_BAT_DAU_NAM_TAI_CHINH, day: 1 }).startOf(
    'day'
  )
  const to = from.plus({ years: 1 }).minus({ days: 1 }).endOf('day')
  return wrapRange(from, to)
}

function wrapRange(from: DateTime, to: DateTime): KpiPeriodRange {
  const f = from.startOf('day')
  const t = to.endOf('day')
  return {
    from: f,
    to: t,
    fromDate: f.toISODate()!,
    toDate: t.toISODate()!,
  }
}

/** Parse query from_date / to_date; mặc định năm tài chính hiện tại. */
export function resolveKpiPeriodRange(
  fromDateRaw?: string | null,
  toDateRaw?: string | null
): KpiPeriodRange {
  const fromStr = String(fromDateRaw ?? '').trim()
  const toStr = String(toDateRaw ?? '').trim()
  if (fromStr && toStr) {
    const from = DateTime.fromISO(fromStr, { zone: 'local' }).startOf('day')
    const to = DateTime.fromISO(toStr, { zone: 'local' }).endOf('day')
    if (from.isValid && to.isValid && from <= to) {
      return wrapRange(from, to)
    }
  }
  return khoangNamTaiChinh()
}

export function publicationTrongKhoangKy(pub: Publication, range: KpiPeriodRange): boolean {
  let d: DateTime | null = pub.publishedAt ?? null
  if (!d && pub.year != null && Number.isFinite(Number(pub.year))) {
    d = DateTime.fromObject({ year: Number(pub.year), month: 12, day: 31 }).startOf('day')
  }
  if (!d?.isValid) return false
  const day = d.startOf('day')
  return day >= range.from && day <= range.to
}

/** Đề tài duyệt: dùng trường year (năm đề tài) nằm trong các năm dương mà khoảng kỳ chạm tới. */
export function projectTrongKhoangKy(proj: ProjectProposal, range: KpiPeriodRange): boolean {
  const y = Number(proj.year)
  if (!Number.isFinite(y)) return false
  const yFrom = range.from.year
  const yTo = range.to.year
  return y >= yFrom && y <= yTo
}
