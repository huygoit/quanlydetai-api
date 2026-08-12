/**
 * Chuỗi ID chức vụ lưu trong position_title / party_position (vd: "3,7,12").
 */

/** Parse chuỗi ID cách nhau dấu phẩy → mảng số duy nhất, giữ thứ tự */
export function parseStaffPositionIds(raw: string | null | undefined): number[] {
  if (!raw) return []
  const seen = new Set<number>()
  const out: number[] = []
  for (const part of String(raw).split(',')) {
    const n = Number(part.trim())
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/** Mảng ID → chuỗi lưu DB hoặc null nếu rỗng */
export function serializeStaffPositionIds(ids: Array<number | string> | null | undefined): string | null {
  if (!ids?.length) return null
  const seen = new Set<number>()
  const out: number[] = []
  for (const raw of ids) {
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out.length ? out.join(',') : null
}

/** Chuẩn hóa input API (string hoặc number[]) */
export function normalizeStaffPositionIdsField(
  value: string | number[] | null | undefined
): string | null {
  if (value == null || value === '') return null
  if (Array.isArray(value)) return serializeStaffPositionIds(value)
  const trimmed = String(value).trim()
  if (!trimmed) return null
  // Đã là chuỗi ID
  if (/^\d+(,\d+)*$/.test(trimmed)) return serializeStaffPositionIds(parseStaffPositionIds(trimmed))
  return trimmed
}

/** Kiểm tra cột chứa ID (PostgreSQL / Lucid where callback) */
export function applyStaffPositionIdFilter(
  query: { where: Function; orWhere: Function },
  column: string,
  positionId: number
) {
  const id = String(positionId)
  query.where((b: any) => {
    b.where(column, id)
      .orWhere(column, 'like', `${id},%`)
      .orWhere(column, 'like', `%,${id}`)
      .orWhere(column, 'like', `%,${id},%`)
  })
}
