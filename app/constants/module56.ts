/**
 * Mã Module 5–6 — khoản chi thống nhất 14 mục (khoan_chi.ts).
 */

import {
  KHOAN_CHI,
  KHOAN_CHI_CODES,
  KHOAN_CHI_MUA_SAM,
  KHOAN_CHI_QUAN_LY,
  nhanKhoanChi,
} from '#constants/khoan_chi'

export const BUDGET_LINE_DEFS = KHOAN_CHI.map((k) => ({
  code: k.code,
  label: k.label,
}))

export type BudgetLineCode = (typeof KHOAN_CHI_CODES)[number]

export const BUDGET_LINE_CODES: BudgetLineCode[] = [...KHOAN_CHI_CODES]

export const PROCUREMENT_LINE_CODES: BudgetLineCode[] = [...KHOAN_CHI_MUA_SAM]

/** Mã quản lý chung (≤ 5% tổng). */
export const BUDGET_LINE_QUAN_LY = KHOAN_CHI_QUAN_LY

export function budgetLineLabel(code: string) {
  return nhanKhoanChi(code)
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
  'YCKT_TU_CHOI',
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
