/**
 * Vai trò thành viên đề xuất đề tài (project_proposal_members.role).
 */
export const PROPOSAL_MEMBER_ROLES = {
  PRINCIPAL: 'PRINCIPAL',
  SECRETARY: 'SECRETARY',
  MEMBER: 'MEMBER',
} as const

export type ProposalMemberRole =
  (typeof PROPOSAL_MEMBER_ROLES)[keyof typeof PROPOSAL_MEMBER_ROLES]

export const PROPOSAL_MEMBER_ROLE_VALUES = Object.values(PROPOSAL_MEMBER_ROLES)

export const PROPOSAL_MEMBER_ROLE_LABELS: Record<ProposalMemberRole, string> = {
  PRINCIPAL: 'Chủ nhiệm',
  SECRETARY: 'Thư ký',
  MEMBER: 'Thành viên',
}

/** Chuẩn hoá giá trị role từ API/FE; không hợp lệ → MEMBER. */
export function resolveProposalMemberRole(raw: unknown): ProposalMemberRole {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (s === 'PRINCIPAL' || s === 'SECRETARY' || s === 'MEMBER') return s
  // Nhãn tiếng Việt / alias
  if (s.includes('CHU') && s.includes('NHIEM')) return 'PRINCIPAL'
  if (s.includes('THU') && s.includes('KY')) return 'SECRETARY'
  return 'MEMBER'
}
