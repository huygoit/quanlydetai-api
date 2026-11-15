import { BUDGET_LINE_CODES, BUDGET_LINE_QUAN_LY } from '#constants/module56'
import { BM06_TEMPLATE_VARIABLE_KEYS } from '#constants/bm06_template_variables'
import {
  formatBangNguonKinhPhi,
  formatBangTienDo,
  normalizeFundingRows,
  normalizeMilestoneRows,
} from '#constants/contract_draft_form'
import { formatVndPlain, numberToVietnameseWords } from '#utils/vietnamese_number_words'

/**
 * Trường lấy lại từ thuyết minh mỗi lần sinh hợp đồng.
 * Các key còn lại giữ giá trị Phòng KH đã sửa.
 */
/**
 * Key lấy lại từ thuyết minh mỗi lần sinh.
 * Thời gian / tiến độ / kinh phí do form dự thảo giữ (không ghi đè khi regen).
 */
export const BM06_OUTLINE_KEYS = [
  'loai_nhiem_vu',
  'ten_nhiem_vu',
  'ma_so_nhiem_vu',
  'muc_tieu',
  'noi_dung_thuc_hien',
  'san_pham_yeu_cau',
  'chu_nhiem',
  'chuc_vu_chu_nhiem',
  'don_vi_chu_nhiem',
  'email_chu_nhiem',
  'dien_thoai_chu_nhiem',
  'to_chuc_ben_b',
  'ten_ben_b',
  'dai_dien_ben_b',
  'chuc_vu_ben_b',
  'chuc_vu_dai_dien_ben_b',
  'email_ben_b',
] as const

const outlineKeySet = new Set<string>(BM06_OUTLINE_KEYS)
const bm06KeySet = new Set<string>(BM06_TEMPLATE_VARIABLE_KEYS)

export function isBm06EditableKey(key: string) {
  return bm06KeySet.has(key) && !outlineKeySet.has(key)
}

/** Giữ phần form dự thảo / điều khoản đã nhập khi sinh lại từ thuyết minh. */
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
  // Giữ JSON nội bộ tiến độ / nguồn kinh phí
  for (const key of ['_tien_do_json', '_nguon_kinh_phi_json']) {
    const old = previous[key]
    if (old != null && String(old).trim() !== '') next[key] = String(old)
  }
  // Đồng bộ lại chữ bảng từ JSON đã giữ (nếu có)
  if (next._tien_do_json || next._nguon_kinh_phi_json) {
    try {
      const milestones = normalizeMilestoneRows(
        next._tien_do_json ? JSON.parse(next._tien_do_json) : []
      )
      const funding = normalizeFundingRows(
        next._nguon_kinh_phi_json ? JSON.parse(next._nguon_kinh_phi_json) : []
      )
      if (milestones.length) next.bang_tien_do = formatBangTienDo(milestones)
      if (funding.some((f) => f.amount > 0) || next._nguon_kinh_phi_json) {
        next.bang_nguon_kinh_phi = formatBangNguonKinhPhi(funding, formatVndPlain)
        const tong = funding.reduce((s, r) => s + r.amount, 0)
        if (tong > 0) {
          next.tong_kinh_phi = formatVndPlain(tong)
          next.kinh_phi_bang_chu = numberToVietnameseWords(tong)
          next.tong_kinh_phi_bang_chu = next.kinh_phi_bang_chu
        }
      }
    } catch {
      // giữ nguyên nếu JSON lỗi
    }
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
  const ql = amounts.get(BUDGET_LINE_QUAN_LY) || 0
  if (ql > Math.round(sum * 0.05)) throw new Error('MUC_09_OVER_5_PERCENT')
}

/** Có mặt >= 2/3 số thành viên đã gán. */
export function hasCouncilQuorum(present: number, total: number) {
  return total > 0 && present * 3 >= total * 2
}

/**
 * ADMIN chỉ mở lại biên bản cuối kỳ khi chưa có việc phía sau
 * (quyết toán đã nộp, giải trình đã nộp, hoặc đã đình chỉ).
 */
export function canReopenFinalMinutes(input: {
  minutesLocked: boolean
  executionStatus: string | null
  settlementStatus: string | null
  settlementLineCount: number
  settlementFileCount: number
  explanationStatus: string | null
}) {
  if (!input.minutesLocked) return false
  if (input.settlementLineCount > 0 || input.settlementFileCount > 0) return false
  if (input.explanationStatus) return false
  if (input.settlementStatus && input.settlementStatus !== 'QT_DRAFT') return false
  if (input.executionStatus === 'DGCK_CHO_QUYET_TOAN') return true
  if (input.executionStatus === 'DGCK_CHINH_SUA') return true
  if (input.executionStatus === 'DGCK_KHONG_DAT') return true
  return false
}
