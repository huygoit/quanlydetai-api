import type { ProjectProposalLevel } from '#models/project_proposal'

/**
 * Ánh xạ mã loại quy trình đề tài (danh mục) → cấp nội bộ dùng khớp kỳ CFP.
 * Khớp FE register form / ProjectProposalsController.
 */
export const QT_CODE_TO_LEVEL: Record<string, ProjectProposalLevel> = {
  'QT-I': 'TRUONG',
  'QT-II': 'BO',
  'QT-III': 'CO_SO',
  'QT-IV': 'NHA_NUOC',
  'QT-V': 'CO_SO',
}

export function levelFromProcessTypeCode(code: string): ProjectProposalLevel {
  return QT_CODE_TO_LEVEL[code] || 'TRUONG'
}
