import type ProjectProposalMember from '#models/project_proposal_member'
import {
  normalizeAuthorGenderEnum,
  resolveGenderForApiDisplay,
} from '#utils/publication_author_api'
import { formatMemberDisplayFullName } from '#utils/member_display_name'

/**
 * DTO camelCase cho GET/PUT /project-proposals/:id/members.
 * Giữ authorOrder (= memberOrder) để FE tái dùng AuthorsEditor.
 * fullName: kèm học hàm/học vị nếu có liên kết hồ sơ NCV.
 */
export function mapProjectProposalMemberToApi(
  m: ProjectProposalMember & {
    profile?: {
      gender?: string | null
      fullName?: string | null
      degree?: string | null
      academicTitle?: string | null
    } | null
    student?: { gender?: string | null; fullName?: string | null } | null
  }
) {
  const gender =
    resolveGenderForApiDisplay(m as any) ?? normalizeAuthorGenderEnum(m.gender)

  const tenGoc =
    m.profileId != null && m.profile
      ? String(m.profile.fullName ?? '').trim() || String(m.fullName ?? '').trim()
      : m.studentId != null && m.student
        ? String(m.student.fullName ?? '').trim() || String(m.fullName ?? '').trim()
        : m.fullName

  // Nếu fullName thành viên đã chứa học hàm/học vị (lưu từ FE), mà không load được tên thuần từ profile → giữ nguyên
  const fullName =
    m.profileId != null && m.profile && String(m.profile.fullName ?? '').trim()
      ? formatMemberDisplayFullName({
          fullName: String(m.profile.fullName).trim(),
          degree: m.profile.degree,
          academicTitle: m.profile.academicTitle,
        })
      : tenGoc

  return {
    id: m.id,
    profileId: m.profileId,
    studentId: m.studentId,
    departmentId: m.departmentId,
    gender,
    fullName,
    affiliationUnits: m.affiliationUnits ?? [],
    /** Đồng bộ với AuthorsEditor */
    authorOrder: m.memberOrder,
    memberOrder: m.memberOrder,
    affiliationType: m.affiliationType,
    isMultiAffiliationOutsideUdn: m.isMultiAffiliationOutsideUdn,
    contributionPercent: m.contributionPercent != null ? Number(m.contributionPercent) : null,
    /** Vai trò đề xuất — FE AuthorsEditor đọc proposalMemberRole */
    role: m.role || 'MEMBER',
    proposalMemberRole: m.role || 'MEMBER',
    /** FE AuthorsEditor vẫn đọc 2 cờ này — luôn false (vai trò bài báo) */
    isTopAuthor: false,
    isCorresponding: false,
  }
}
