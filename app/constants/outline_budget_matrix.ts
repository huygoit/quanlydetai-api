/**
 * Ma trận kinh phí thuyết minh — mirror FE src/constants/outlineBudgetMatrix.ts
 */

export const OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES = [
  'THU_LAO',
  'VAT_LIEU',
  'HOI_NGHI',
  'THUE_NGOAI',
  'DIEU_TRA',
  'VAN_PHONG',
  'CONG_BO',
  'TU_DANH_GIA',
  'TU_VAN_SHTT',
  'PHO_BIEN',
  'CHI_KHAC',
] as const

export type OutlineBudgetEditableExpenseCode =
  (typeof OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES)[number]

export type OutlineBudgetExpenseCode = OutlineBudgetEditableExpenseCode | 'QUAN_LY'

export type OutlineBudgetExpenseAmounts = Partial<Record<OutlineBudgetExpenseCode, number>>

export type OutlineBudgetMatrix = {
  STATE_LUMP: OutlineBudgetExpenseAmounts
  STATE_NON_LUMP: OutlineBudgetExpenseAmounts
  NON_STATE: OutlineBudgetExpenseAmounts
}

export const OUTLINE_BUDGET_EXPENSE_LABELS: Record<OutlineBudgetExpenseCode, string> = {
  THU_LAO: 'Thù lao thực hiện nhiệm vụ; chi thuê chuyên gia (nếu có)',
  VAT_LIEU: 'Nguyên, nhiên, vật liệu, công cụ, dụng cụ, mua sắm, sửa chữa',
  HOI_NGHI: 'Công tác tổ chức, tham gia hội nghị',
  THUE_NGOAI: 'Dịch vụ thuê ngoài',
  DIEU_TRA: 'Điều tra, khảo sát thu thập số liệu',
  VAN_PHONG: 'Văn phòng phẩm, thông tin liên lạc, in ấn',
  CONG_BO: 'Công bố công trình KH&CN trong nước và quốc tế',
  TU_DANH_GIA: 'Tự đánh giá kết quả thực hiện nhiệm vụ',
  TU_VAN_SHTT: 'Tư vấn đăng ký bảo hộ quyền SHTT',
  PHO_BIEN: 'Phổ biến, tuyên truyền kết quả của nhiệm vụ',
  QUAN_LY: 'Công tác quản lý chung nhiệm vụ (5% tổng kinh phí)',
  CHI_KHAC: 'Chi khác liên quan trực tiếp đến thực hiện nhiệm vụ',
}

export const EXPENSE_TO_BUDGET_GROUP: Record<
  OutlineBudgetExpenseCode,
  'NHAN_CONG' | 'VAT_TU' | 'HOI_THAO' | 'KHAC'
> = {
  THU_LAO: 'NHAN_CONG',
  VAT_LIEU: 'VAT_TU',
  HOI_NGHI: 'HOI_THAO',
  THUE_NGOAI: 'KHAC',
  DIEU_TRA: 'KHAC',
  VAN_PHONG: 'KHAC',
  CONG_BO: 'KHAC',
  TU_DANH_GIA: 'KHAC',
  TU_VAN_SHTT: 'KHAC',
  PHO_BIEN: 'KHAC',
  QUAN_LY: 'KHAC',
  CHI_KHAC: 'KHAC',
}

function money0(v: unknown): number {
  const n = Math.round(Number(v || 0))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function normalizeBudgetMatrix(
  raw?: Partial<OutlineBudgetMatrix> | null
): OutlineBudgetMatrix {
  const pick = (r?: OutlineBudgetExpenseAmounts | null) => {
    const o: OutlineBudgetExpenseAmounts = {}
    for (const code of OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES) {
      o[code] = money0(r?.[code])
    }
    return o
  }
  return {
    STATE_LUMP: pick(raw?.STATE_LUMP),
    STATE_NON_LUMP: pick(raw?.STATE_NON_LUMP),
    NON_STATE: pick(raw?.NON_STATE),
  }
}

export function sumEditableExpenses(row: OutlineBudgetExpenseAmounts): number {
  return OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES.reduce((s, code) => s + money0(row[code]), 0)
}

/** quanLy = 5% tổng ⇒ quanLy = editable * 0.05 / 0.95 */
export function calcQuanLyFromEditable(editableSum: number): number {
  if (editableSum <= 0) return 0
  return Math.round((editableSum * 0.05) / 0.95)
}

export function calcRowComputed(row: OutlineBudgetExpenseAmounts) {
  const editableSum = sumEditableExpenses(row)
  const quanLy = calcQuanLyFromEditable(editableSum)
  return { editableSum, quanLy, tong: editableSum + quanLy }
}

export function flattenBudgetMatrixToLines(matrix: OutlineBudgetMatrix): Array<{
  groupCode: 'NHAN_CONG' | 'VAT_TU' | 'HOI_THAO' | 'KHAC'
  content: string
  amount: number
  note: string | null
  lineOrder: number
}> {
  const sources: Array<{ key: keyof OutlineBudgetMatrix; label: string }> = [
    { key: 'STATE_LUMP', label: 'NSNN — khoán chi' },
    { key: 'STATE_NON_LUMP', label: 'NSNN — không khoán chi' },
    { key: 'NON_STATE', label: 'Ngoài NSNN' },
  ]
  const lines: Array<{
    groupCode: 'NHAN_CONG' | 'VAT_TU' | 'HOI_THAO' | 'KHAC'
    content: string
    amount: number
    note: string | null
    lineOrder: number
  }> = []
  let order = 1
  for (const src of sources) {
    const row = matrix[src.key] || {}
    const { quanLy } = calcRowComputed(row)
    for (const code of OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES) {
      const amount = money0(row[code])
      if (!amount) continue
      lines.push({
        groupCode: EXPENSE_TO_BUDGET_GROUP[code],
        content: `${src.label}: ${OUTLINE_BUDGET_EXPENSE_LABELS[code]}`,
        amount,
        note: null,
        lineOrder: order++,
      })
    }
    if (quanLy > 0) {
      lines.push({
        groupCode: 'KHAC',
        content: `${src.label}: ${OUTLINE_BUDGET_EXPENSE_LABELS.QUAN_LY}`,
        amount: quanLy,
        note: 'Tự tính 5% tổng',
        lineOrder: order++,
      })
    }
  }
  return lines
}
