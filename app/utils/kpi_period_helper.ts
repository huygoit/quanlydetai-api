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

/** Tháng bắt đầu năm học (khớp FE: từ tháng 8). */
export const THANG_BAT_DAU_NAM_HOC = 8

/**
 * Khoảng năm học từ chuỗi "2024-2025": 01/08/2024 → 31/07/2025.
 * Nếu chuỗi không hợp lệ thì trả về null.
 */
export function khoangNamHoc(academicYear?: string | null): KpiPeriodRange | null {
  const str = String(academicYear ?? '').trim()
  const m = str.match(/^(\d{4})\s*-\s*(\d{4})$/)
  const startYear = m ? Number(m[1]) : Number(str)
  if (!Number.isFinite(startYear) || startYear < 1900) return null
  const from = DateTime.fromObject({
    year: startYear,
    month: THANG_BAT_DAU_NAM_HOC,
    day: 1,
  }).startOf('day')
  const to = from.plus({ years: 1 }).minus({ days: 1 }).endOf('day')
  return wrapRange(from, to)
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
  // Chặt chẽ: chỉ tính KQNC có ngày xuất bản thật; bản ghi chỉ có năm (thiếu published_at) bị bỏ qua.
  const d: DateTime | null = pub.publishedAt ?? null
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
