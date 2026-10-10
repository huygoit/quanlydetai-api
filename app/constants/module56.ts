/**
 * Mã Module 5–6 đã chốt trong prompts/module-5-6.md.
 * Không dùng NT_* / ĐGCK_* / YCKT_CSVC.
 */

export const BUDGET_LINE_DEFS = [
  { code: 'MUC_01', label: 'Công lao động trực tiếp' },
  { code: 'MUC_02', label: 'Vật tư' },
  { code: 'MUC_03', label: 'TSCĐ' },
  { code: 'MUC_04', label: 'Hội thảo / công tác phí' },
  { code: 'MUC_05', label: 'Thuê ngoài' },
  { code: 'MUC_06', label: 'Điều tra, khảo sát' },
  { code: 'MUC_07', label: 'Văn phòng phẩm' },
  { code: 'MUC_08', label: 'Họp hội đồng' },
  { code: 'MUC_09', label: 'Quản lý chung' },
  { code: 'MUC_10', label: 'Chi khác' },
] as const

export type BudgetLineCode = (typeof BUDGET_LINE_DEFS)[number]['code']

export const BUDGET_LINE_CODES: BudgetLineCode[] = BUDGET_LINE_DEFS.map((d) => d.code)

export const PROCUREMENT_LINE_CODES: BudgetLineCode[] = ['MUC_02', 'MUC_03', 'MUC_05']

export function budgetLineLabel(code: string) {
  return BUDGET_LINE_DEFS.find((d) => d.code === code)?.label || code
}

export const CONTRACT_FLOW = [
  'HOP_DONG_DRAFT',
  'HOP_DONG_CHO_CNNV',
  'HOP_DONG_CHO_KY',
  'HOP_DONG_CHO_PHAT_HANH',
  'HOP_DONG_DA_KY',
] as const

export type ContractFlowStatus = (typeof CONTRACT_FLOW)[number]

export const EXECUTION_FLOW = [
  'DANG_THUC_HIEN',
  'DGCK_DRAFT',
  'DGCK_CHO_PKH',
  'DGCK_BS',
  'DGCK_HOP_HD',
  'DGCK_CHINH_SUA',
  'DGCK_KHONG_DAT',
  'DGCK_DINH_CHI',
  'DGCK_CHO_QUYET_TOAN',
  'DGCK_CHO_THANH_LY',
  'HOAN_THANH',
] as const

export type ExecutionStatus = (typeof EXECUTION_FLOW)[number]

export const YCKT_FLOW = [
  'YCKT_DRAFT',
  'YCKT_PKH',
  'YCKT_BS',
  'YCKT_TC',
  'YCKT_DONE',
] as const

export type YcktStatus = (typeof YCKT_FLOW)[number]

export const MS_FLOW = [
  'MS_DRAFT',
  'MS_CHO_PKH',
  'MS_BS',
  'MS_CHO_CSVC',
  'MS_TU_CHOI',
  'MS_DAU_THAU_THAT_BAI',
  'MS_DONG',
  'MS_CHO_NHAN',
  'MS_CHO_TC',
  'MS_DONE',
] as const

export type MsStatus = (typeof MS_FLOW)[number]

export const BCTD_FLOW = ['BCTD_DRAFT', 'BCTD_CHO_PKH', 'BCTD_BS', 'BCTD_DONE'] as const
export type BctdStatus = (typeof BCTD_FLOW)[number]

export const DC_FLOW = [
  'DC_DRAFT',
  'DC_PENDING_PKH',
  'DC_BS',
  'DC_PENDING_BGH',
  'DC_APPROVED',
  'DC_REJECTED',
] as const
export type DcStatus = (typeof DC_FLOW)[number]

export const QT_FLOW = ['QT_DRAFT', 'QT_CHO_PKH', 'QT_CHO_TC', 'QT_BS', 'QT_DONE'] as const
export type QtStatus = (typeof QT_FLOW)[number]

export const COUNCIL_ROLES = ['CHU_TICH', 'THU_KY', 'PHAN_BIEN', 'UY_VIEN'] as const
export type CouncilRole = (typeof COUNCIL_ROLES)[number]

export const CLASSIFICATIONS = ['DAT_YEU_CAU', 'CAN_BO_SUNG', 'KHONG_DAT'] as const
export type FinalClassification = (typeof CLASSIFICATIONS)[number]

export const CLASSIFICATION_LABEL: Record<FinalClassification, string> = {
  DAT_YEU_CAU: 'Đạt yêu cầu',
  CAN_BO_SUNG: 'Cần bổ sung, hoàn thiện',
  KHONG_DAT: 'Không đạt yêu cầu',
}

export const FILE_LIMIT = {
  payment: 10 * 1024 * 1024,
  procurement: 10 * 1024 * 1024,
  progressTotal: 50 * 1024 * 1024,
  summary: 30 * 1024 * 1024,
  brief: 10 * 1024 * 1024,
}

export const PROGRESS_REMIND_DAYS = [30, 14, 7, 3] as const
