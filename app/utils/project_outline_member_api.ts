import type ProjectOutlineMember from '#models/project_outline_member'
import {
  normalizeAuthorGenderEnum,
  resolveGenderForApiDisplay,
} from '#utils/publication_author_api'
import { formatMemberDisplayFullName } from '#utils/member_display_name'

/**
 * DTO camelCase cho thành viên thuyết minh — cùng shape AuthorsEditor / đề xuất.
 */
export function mapProjectOutlineMemberToApi(
  m: ProjectOutlineMember & {
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
    authorOrder: m.memberOrder,
    memberOrder: m.memberOrder,
    affiliationType: m.affiliationType,
    isMultiAffiliationOutsideUdn: !!m.isMultiAffiliationOutsideUdn,
    contributionPercent: m.contributionPercent != null ? Number(m.contributionPercent) : null,
    participationHours: m.participationHours != null ? Number(m.participationHours) : null,
    role: m.role || 'MEMBER',
    proposalMemberRole: m.role || 'MEMBER',
    isTopAuthor: false,
    isCorresponding: false,
  }
}
