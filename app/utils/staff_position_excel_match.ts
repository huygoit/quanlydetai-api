/**
 * Khớp tên chức vụ Excel → ID danh mục.
 * Excel thường kèm ngày/QĐ/đơn vị/viết tắt — không so khớp nguyên chuỗi.
 */

export type CatalogChucVu = { id: number; name: string }

/** Chuẩn hóa để so khớp: bỏ dấu, đ→d, thường, gom khoảng trắng */
export function chuanHoaTenChucVu(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Mở rộng viết tắt thường gặp trên Excel HR */
export function moRongVietTatChucVu(norm: string): string {
  let s = ` ${norm} `
  const reps: Array<[RegExp, string]> = [
    [/\buv bch\b/g, ' uy vien ban chap hanh '],
    [/\buy vien bch\b/g, ' uy vien ban chap hanh '],
    [/\buv thuong vu\b/g, ' uy vien ban thuong vu '],
    [/\buy vien tv\b/g, ' uy vien thuong vu '],
    [/\buy vien btv\b/g, ' uy vien ban thuong vu '],
    [/\bco quan dhdn\b/g, ' co quan dai hoc da nang '],
    [/\bchu tich hoi sinh vien truong\b/g, ' chu tich hoi sinh vien '],
    [/\bke toan truong\b/g, ' ke toan truong '],
  ]
  for (const [re, to] of reps) s = s.replace(re, to)
  return s.replace(/\s+/g, ' ').trim()
}

function boNhieuNgayQd(norm: string): string {
  return norm
    .replace(/\b\d{1,2} \d{1,2} \d{2,4}\b/g, ' ')
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\bqd\b/g, ' ')
    .replace(/\bngay\b/g, ' ')
    .replace(/\bhet ngay\b/g, ' ')
    .replace(/\btu ngay\b/g, ' ')
    .replace(/\bden het\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function khongBiPhoDan(haystack: string, index: number, needle: string): boolean {
  if (needle.startsWith('pho ')) return true
  const truoc = haystack.slice(Math.max(0, index - 4), index)
  return truoc !== 'pho '
}

/**
 * Tìm mọi ID catalog xuất hiện trong chuỗi Excel (ưu tiên tên dài hơn).
 * Trả unmatched = phần còn lại sau khi đã “ăn” các tên catalog.
 */
export function timIdChucVuTrongChuoi(
  raw: string | null | undefined,
  catalog: CatalogChucVu[]
): { ids: number[]; unmatched: string[] } {
  if (!raw?.trim()) return { ids: [], unmatched: [] }

  const parts = raw
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)

  const ids = new Set<number>()
  const unmatched: string[] = []

  const needles = catalog
    .map((c) => ({
      id: c.id,
      name: c.name,
      needle: moRongVietTatChucVu(chuanHoaTenChucVu(c.name)),
    }))
    .filter((x) => x.needle.length >= 4)
    .sort((a, b) => b.needle.length - a.needle.length)

  for (const part of parts) {
    let hay = moRongVietTatChucVu(chuanHoaTenChucVu(part))
    hay = boNhieuNgayQd(hay)
    if (!hay) continue

    const consumed: Array<{ start: number; end: number }> = []
    const hitIds: number[] = []

    for (const item of needles) {
      let from = 0
      while (from <= hay.length) {
        const idx = hay.indexOf(item.needle, from)
        if (idx < 0) break
        const end = idx + item.needle.length
        const daAn = consumed.some((r) => !(end <= r.start || idx >= r.end))
        if (!daAn && khongBiPhoDan(hay, idx, item.needle)) {
          consumed.push({ start: idx, end })
          hitIds.push(item.id)
          break
        }
        from = idx + 1
      }
    }

    for (const id of hitIds) ids.add(id)

    if (hitIds.length === 0) {
      unmatched.push(part.trim())
    }
  }

  return { ids: [...ids], unmatched }
}
