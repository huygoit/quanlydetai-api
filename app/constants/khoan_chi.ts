/**
 * Danh mục khoản chi dùng chung toàn hệ thống.
 * Chuẩn = cột khoản chi thuyết minh (ma trận kinh phí) — hợp đồng / tạm ứng / mua sắm cùng mã.
 */

import {
  OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER,
  OUTLINE_BUDGET_EXPENSE_LABELS,
  type OutlineBudgetExpenseCode,
} from '#constants/outline_budget_matrix'

export type KhoanChiDef = {
  code: OutlineBudgetExpenseCode
  stt: number
  label: string
  /** Mục quản lý chung ≤ 5% tổng */
  isQuanLyChung?: boolean
}

export const KHOAN_CHI: KhoanChiDef[] = OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER.map(
  (code, index) => ({
    code,
    stt: index + 1,
    label: OUTLINE_BUDGET_EXPENSE_LABELS[code],
    isQuanLyChung: code === 'QUAN_LY',
  })
)

export const KHOAN_CHI_CODES = KHOAN_CHI.map((k) => k.code)

export const KHOAN_CHI_QUAN_LY = 'QUAN_LY' as const

/** Mã dùng cho đề nghị mua sắm (NVL/mua sắm + thuê ngoài) */
export const KHOAN_CHI_MUA_SAM = ['VAT_LIEU', 'THUE_NGOAI'] as const

/** Map mã cũ (14 mục MUC_*) → mã chuẩn thuyết minh — migrate dữ liệu. */
export const LEGACY_MUC_TO_KHOAN: Record<string, OutlineBudgetExpenseCode> = {
  MUC_01: 'THU_LAO',
  MUC_02A: 'THU_LAO',
  MUC_02B: 'THU_LAO',
  MUC_02: 'THU_LAO',
  MUC_03: 'VAT_LIEU',
  MUC_04: 'VAT_LIEU',
  MUC_05: 'HOI_NGHI',
  MUC_06: 'THUE_NGOAI',
  MUC_07: 'DIEU_TRA',
  MUC_08: 'VAN_PHONG',
  MUC_09: 'CONG_BO',
  MUC_10: 'TU_DANH_GIA',
  MUC_11: 'TU_VAN_SHTT',
  MUC_12: 'PHO_BIEN',
  MUC_13: 'QUAN_LY',
  MUC_14: 'CHI_KHAC',
}

export function nhanKhoanChi(code: string) {
  const hit = KHOAN_CHI.find((k) => k.code === code)
  if (!hit) return code
  return `${hit.stt}. ${hit.label}`
}

export function laKhoanChiHopLe(code: string) {
  return (KHOAN_CHI_CODES as string[]).includes(code)
}

export function chuanHoaMaKhoanChi(code: string): string {
  const raw = String(code || '').trim()
  if (!raw) return raw
  if ((KHOAN_CHI_CODES as string[]).includes(raw)) return raw
  return LEGACY_MUC_TO_KHOAN[raw] || raw
}
