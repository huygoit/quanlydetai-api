/**
 * Form dự thảo hợp đồng BM-02.14 — cấu trúc gọn, khớp UI + biến merge Word.
 */

export type ContractMilestoneRow = {
  content: string
  thoiGian: string
  sanPham: string
}

export type ContractFundingCode = 'NSNN' | 'KP_TRUONG' | 'DOI_UNG' | 'NGUON_KHAC'

export type ContractFundingRow = {
  code: ContractFundingCode
  label: string
  amount: number
}

export const CONTRACT_FUNDING_DEFS: { code: ContractFundingCode; label: string }[] = [
  { code: 'NSNN', label: 'Kinh phí từ ngân sách nhà nước' },
  { code: 'KP_TRUONG', label: 'Kinh phí KH,CN&ĐMST của Trường' },
  { code: 'DOI_UNG', label: 'Kinh phí đối ứng' },
  { code: 'NGUON_KHAC', label: 'Nguồn khác' },
]

/** Key nội bộ lưu JSON trong merge_payload (không đổ vào Word). */
export const DRAFT_MILESTONES_KEY = '_tien_do_json'
export const DRAFT_FUNDING_KEY = '_nguon_kinh_phi_json'

export function emptyFundingRows(defaultTotal = 0): ContractFundingRow[] {
  return CONTRACT_FUNDING_DEFS.map((d, i) => ({
    code: d.code,
    label: d.label,
    amount: i === 0 ? Math.max(0, Math.round(defaultTotal)) : 0,
  }))
}

export function normalizeFundingRows(
  raw: unknown,
  fallbackTotal = 0
): ContractFundingRow[] {
  const list = Array.isArray(raw) ? raw : []
  const byCode = new Map<string, number>()
  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    const code = String((row as any).code || '').trim()
    const amount = Math.max(0, Math.round(Number((row as any).amount) || 0))
    if (code) byCode.set(code, amount)
  }
  const rows = CONTRACT_FUNDING_DEFS.map((d) => ({
    code: d.code,
    label: d.label,
    amount: byCode.get(d.code) ?? 0,
  }))
  const sum = rows.reduce((s, r) => s + r.amount, 0)
  if (sum === 0 && fallbackTotal > 0) {
    rows[0]!.amount = Math.round(fallbackTotal)
  }
  return rows
}

export function normalizeMilestoneRows(raw: unknown): ContractMilestoneRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const content = String(r.content ?? r.noiDung ?? '').trim()
      const thoiGian = chuanHoaThoiGian(
        String(r.thoiGian ?? r.thoi_gian ?? r.timeRange ?? '').trim()
      )
      const sanPham = String(
        r.sanPham ?? r.san_pham ?? r.expectedResult ?? r.result ?? ''
      ).trim()
      if (!content && !thoiGian && !sanPham) return null
      return { content, thoiGian, sanPham }
    })
    .filter(Boolean) as ContractMilestoneRow[]
}

/** Chữ bảng tiến độ đưa vào Word. */
export function formatBangTienDo(rows: ContractMilestoneRow[]): string {
  if (!rows.length) return ''
  const lines = [
    'STT | Nội dung công việc | Thời gian thực hiện | Sản phẩm/kết quả',
    ...rows.map(
      (r, i) =>
        `${i + 1} | ${r.content || '—'} | ${r.thoiGian || '—'} | ${r.sanPham || '—'}`
    ),
  ]
  return lines.join('\n')
}

/** Chữ bảng nguồn kinh phí đưa vào Word. */
export function formatBangNguonKinhPhi(
  rows: ContractFundingRow[],
  formatMoney: (n: number) => string
): string {
  const tong = rows.reduce((s, r) => s + r.amount, 0)
  const lines = [
    'Nguồn kinh phí | Số tiền',
    ...rows.map((r) => `${r.label} | ${formatMoney(r.amount)}`),
    `Tổng cộng | ${formatMoney(tong)}`,
  ]
  return lines.join('\n')
}

/** Chuẩn hóa mọi dạng ngày về dd/MM/yyyy. */
export function toDdMmYyyy(raw?: string | null): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  // Đã đúng dd/MM/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${d!.padStart(2, '0')}/${m!.padStart(2, '0')}/${y}`
  }
  // ISO / yyyy-MM-dd (+ time)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  // Thử Date parse
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    const dt = new Date(t)
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const yyyy = String(dt.getFullYear())
    return `${dd}/${mm}/${yyyy}`
  }
  return s
}

/** Chuẩn hóa khoảng "a → b" về dd/MM/yyyy → dd/MM/yyyy. */
export function chuanHoaThoiGian(raw?: string | null): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  // Không tách bằng `-` đơn (tránh cắt nhầm ISO yyyy-MM-dd)
  const parts = s
    .split(/\s*(?:→|->|–|—|\s-\s|đến|toi|tới)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    const a = toDdMmYyyy(parts[0])
    const b = toDdMmYyyy(parts[1])
    if (a && b) return `${a} → ${b}`
  }
  const one = toDdMmYyyy(s)
  return one || s
}

export function milestonesFromOutline(
  milestones: Array<{
    content?: string | null
    startDate?: string | null
    endDate?: string | null
    expectedResult?: string | null
  }> | null
): ContractMilestoneRow[] {
  return (milestones || [])
    .map((m) => {
      const tu = toDdMmYyyy(m.startDate)
      const den = toDdMmYyyy(m.endDate)
      const thoiGian = [tu, den].filter(Boolean).join(' → ')
      return {
        content: (m.content || '').trim(),
        thoiGian,
        sanPham: (m.expectedResult || '').trim(),
      }
    })
    .filter((r) => r.content || r.thoiGian || r.sanPham)
}
