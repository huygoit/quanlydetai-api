import { BUDGET_LINE_CODES } from '#constants/module56'
import { BM06_TEMPLATE_VARIABLE_KEYS } from '#constants/bm06_template_variables'

/**
 * Trường lấy lại từ thuyết minh mỗi lần sinh hợp đồng.
 * Các key còn lại giữ giá trị Phòng KH đã sửa.
 */
export const BM06_OUTLINE_KEYS = [
  'loai_nhiem_vu',
  'ten_nhiem_vu',
  'so_thang_thuc_hien',
  'thang_bat_dau',
  'nam_bat_dau',
  'thang_ket_thuc',
  'nam_ket_thuc',
  'ten_ben_b',
  'dai_dien_ben_b',
  'email_ben_b',
  'tong_kinh_phi',
  'tong_kinh_phi_bang_chu',
  'kinh_phi_nsnn',
  'kinh_phi_nsnn_bang_chu',
] as const

const outlineKeySet = new Set<string>(BM06_OUTLINE_KEYS)
const bm06KeySet = new Set<string>(BM06_TEMPLATE_VARIABLE_KEYS)

export function isBm06EditableKey(key: string) {
  return bm06KeySet.has(key) && !outlineKeySet.has(key)
}

/** Giữ điều khoản Phòng KH đã nhập khi sinh lại từ thuyết minh. */
export function mergeBm06Edits(
  fresh: Record<string, string>,
  previous: Record<string, string> | null | undefined
) {
  if (!previous) return { ...fresh }
  const next = { ...fresh }
  for (const key of BM06_TEMPLATE_VARIABLE_KEYS) {
    if (!isBm06EditableKey(key)) continue
    const old = previous[key]
    if (old != null && String(old).trim() !== '') next[key] = String(old)
  }
  return next
}

/** Ghi đè các điều khoản được phép sửa. Bỏ key lạ và key lấy từ thuyết minh. */
export function applyBm06Edits(
  current: Record<string, string>,
  edits: Record<string, unknown> | null | undefined
) {
  const next = { ...current }
  let changed = 0
  for (const [key, value] of Object.entries(edits || {})) {
    if (!isBm06EditableKey(key)) continue
    next[key] = value == null ? '' : String(value)
    changed += 1
  }
  if (changed === 0) throw new Error('FIELDS_REQUIRED')
  return next
}

export function assertBudgetAmounts(amounts: Map<string, number>, approvedTotal: number) {
  if (amounts.size !== BUDGET_LINE_CODES.length) throw new Error('BUDGET_LINES_INCOMPLETE')
  let sum = 0
  for (const code of BUDGET_LINE_CODES) sum += amounts.get(code) || 0
  if (sum !== approvedTotal) throw new Error('BUDGET_SUM_MISMATCH')
  const muc09 = amounts.get('MUC_09') || 0
  if (muc09 > Math.round(sum * 0.05)) throw new Error('MUC_09_OVER_5_PERCENT')
}

/** Có mặt >= 2/3 số thành viên đã gán. */
export function hasCouncilQuorum(present: number, total: number) {
  return total > 0 && present * 3 >= total * 2
}
