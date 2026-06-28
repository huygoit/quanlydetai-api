import type PublicationAuthor from '#models/publication_author'
import type { AuthorGender } from '#models/publication_author'

/** Chuẩn hoá gender về MALE | FEMALE | OTHER — khớp FE. */
export function normalizeAuthorGenderEnum(raw: string | null | undefined): AuthorGender | null {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim()
  const upper = s.toUpperCase()
  if (upper === 'MALE' || s === 'Nam') return 'MALE'
  if (upper === 'FEMALE' || s === 'Nữ' || s === 'Nu') return 'FEMALE'
  if (upper === 'OTHER' || s === 'Khác' || s === 'Khac') return 'OTHER'
  return null
}

/** Giới tính dùng KPI: ưu tiên hồ sơ NCV → sinh viên → cột gender nhập tay. */
export function genderForPublicationAuthorRow(
  a: PublicationAuthor & { profile?: { gender?: string | null } | null; student?: { gender?: string | null } | null }
): string | null | undefined {
  if (a.profileId != null && a.profile) return a.profile.gender
  if (a.studentId != null && a.student) return a.student.gender
  return a.gender
}

/** Giới tính hiển thị API — luôn trả (kể cả tác giả liên kết hệ thống). */
export function resolveGenderForApiDisplay(
  a: PublicationAuthor & { profile?: { gender?: string | null } | null; student?: { gender?: string | null } | null }
): AuthorGender | null {
  return normalizeAuthorGenderEnum(genderForPublicationAuthorRow(a))
}

/** DTO camelCase trả về GET/PUT /publications/:id/authors */
export function mapPublicationAuthorToApi(
  a: PublicationAuthor & { profile?: { gender?: string | null } | null; student?: { gender?: string | null } | null }
) {
  return {
    id: a.id,
    profileId: a.profileId,
    studentId: a.studentId,
    gender: resolveGenderForApiDisplay(a),
    fullName: a.fullName,
    affiliationUnits: a.affiliationUnits ?? [],
    authorOrder: a.authorOrder,
    isTopAuthor: a.isTopAuthor,
    isCorresponding: a.isCorresponding,
    affiliationType: a.affiliationType,
    isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
    contributionPercent: a.contributionPercent != null ? Number(a.contributionPercent) : null,
  }
}
