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

/** Thứ tự cột khoản chi giống FE BudgetMatrixTable (cột 4→15). */
export const OUTLINE_BUDGET_EXPENSE_COLUMN_ORDER: OutlineBudgetExpenseCode[] = [
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
  'QUAN_LY',
  'CHI_KHAC',
]

/** Header ngắn xuất Word — khớp cột trên web. */
export const OUTLINE_BUDGET_EXPENSE_WORD_HEADERS: Record<
  OutlineBudgetExpenseCode,
  { colNo: number; label: string; hint?: string }
> = {
  THU_LAO: { colNo: 4, label: 'Thù lao; thuê chuyên gia' },
  VAT_LIEU: { colNo: 5, label: 'Nguyên vật liệu, công cụ…', hint: 'Khoán chi' },
  HOI_NGHI: { colNo: 6, label: 'Hội nghị', hint: 'Khoán chi' },
  THUE_NGOAI: { colNo: 7, label: 'Dịch vụ thuê ngoài' },
  DIEU_TRA: { colNo: 8, label: 'Điều tra, khảo sát' },
  VAN_PHONG: { colNo: 9, label: 'Văn phòng phẩm, in ấn' },
  CONG_BO: { colNo: 10, label: 'Công bố KH&CN' },
  TU_DANH_GIA: { colNo: 11, label: 'Tự đánh giá' },
  TU_VAN_SHTT: { colNo: 12, label: 'Tư vấn SHTT' },
  PHO_BIEN: { colNo: 13, label: 'Phổ biến kết quả' },
  QUAN_LY: { colNo: 14, label: 'Quản lý chung', hint: '5% tổng' },
  CHI_KHAC: { colNo: 15, label: 'Chi khác' },
}

/** Dòng nguồn — cùng thứ tự / nhãn FE OUTLINE_BUDGET_SOURCE_ROWS. */
export const OUTLINE_BUDGET_SOURCE_ROWS = [
  { key: 'TOTAL' as const, stt: '1', label: 'Tổng kinh phí', kind: 'total' as const, indent: 0 },
  { key: 'HEADER' as const, stt: '', label: 'Trong đó:', kind: 'header' as const, indent: 0 },
  { key: 'STATE' as const, stt: '1.1', label: 'Ngân sách nhà nước', kind: 'group' as const, indent: 1 },
  {
    key: 'STATE_LUMP' as const,
    stt: '',
    label: 'a. Kinh phí khoán chi',
    kind: 'input' as const,
    indent: 2,
  },
  {
    key: 'STATE_NON_LUMP' as const,
    stt: '',
    label: 'b. Kinh phí không khoán chi',
    kind: 'input' as const,
    indent: 2,
  },
  {
    key: 'NON_STATE' as const,
    stt: '1.2',
    label: 'Nguồn ngoài ngân sách nhà nước',
    kind: 'input' as const,
    indent: 1,
  },
]

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

/** Cộng hai dòng khoản chi (không gồm QUAN_LY — tự tính lại). */
export function addExpenseRows(
  a: OutlineBudgetExpenseAmounts,
  b: OutlineBudgetExpenseAmounts
): OutlineBudgetExpenseAmounts {
  const out: OutlineBudgetExpenseAmounts = {}
  for (const code of OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES) {
    out[code] = money0(a[code]) + money0(b[code])
  }
  return out
}

/** Giống FE calcRowTotal — đủ amounts từng cột + tổng. */
export function calcRowTotal(row: OutlineBudgetExpenseAmounts): {
  editableSum: number
  quanLy: number
  tong: number
  amounts: Record<OutlineBudgetExpenseCode, number>
} {
  const editableSum = sumEditableExpenses(row)
  const quanLy = calcQuanLyFromEditable(editableSum)
  const amounts = {} as Record<OutlineBudgetExpenseCode, number>
  for (const code of OUTLINE_BUDGET_EDITABLE_EXPENSE_CODES) {
    amounts[code] = money0(row[code])
  }
  amounts.QUAN_LY = quanLy
  return { editableSum, quanLy, tong: editableSum + quanLy, amounts }
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
