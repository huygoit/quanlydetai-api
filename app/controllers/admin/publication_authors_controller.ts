import type { HttpContext } from '@adonisjs/core/http'
import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import {
  upsertPublicationAuthorsValidator,
  validateAuthorsListRules,
  validateManualAuthorGender,
  validateAdminAuthorsHaveAtLeastOneNcvLink,
  prepareAuthorsRequestBody,
  resolvedProfileIdFromRow,
  resolvedStudentIdFromRow,
  resolvedGenderForSave,
} from '#validators/publication_author_validator'
import ScientificProfileAdminService from '#services/scientific_profile_admin_service'
import { formatAuthorsDisplayFromRows } from '#utils/publication_authors_display'
import { mapPublicationAuthorToApi } from '#utils/publication_author_api'

const OTHER_UNIT_LABEL = 'Other Organization (Đơn vị khác)'
const LEGACY_OTHER_UNIT_LABEL = 'Đơn vị khác'

function deriveAffiliationTypeFromUnits(
  units: string[] | undefined
): 'UDN_ONLY' | 'MIXED' | 'OUTSIDE' | null {
  const picked = Array.isArray(units)
    ? Array.from(
        new Set(
          units
            .map((v) => String(v ?? '').trim())
            .filter((v) => v.length > 0)
        )
      )
    : []
  if (picked.length === 0) return null
  const hasOutside = picked.includes(OTHER_UNIT_LABEL) || picked.includes(LEGACY_OTHER_UNIT_LABEL)
  const hasUdn = picked.some((v) => v !== OTHER_UNIT_LABEL && v !== LEGACY_OTHER_UNIT_LABEL)
  if (hasOutside && hasUdn) return 'MIXED'
  if (hasOutside) return 'OUTSIDE'
  return 'UDN_ONLY'
}

/**
 * Admin: tác giả KQNC — không giới hạn theo hồ sơ đăng nhập.
 */
export default class AdminPublicationAuthorsController {
  private async findPublication(pubId: number) {
    return Publication.query().where('id', pubId).first()
  }

  /** GET /api/admin/publications/:id/authors */
  async index({ params, response }: HttpContext) {
    const pubId = Number(params.id)
    if (!Number.isFinite(pubId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const publication = await this.findPublication(pubId)
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy kết quả NCKH.' })
    }

    const authors = await PublicationAuthor.query()
      .where('publication_id', pubId)
      .preload('profile', (q) => q.select('id', 'gender'))
      .preload('student', (q) => q.select('id', 'gender'))
      .orderBy('author_order', 'asc')

    const adminProfileIds = await ScientificProfileAdminService.adminProfileIdsAmong(
      authors.map((a) => a.profileId).filter((id): id is number => id != null)
    )
    const visibleAuthors = authors.filter(
      (a) => a.profileId == null || !adminProfileIds.has(Number(a.profileId))
    )

    const data = visibleAuthors.map((a) => mapPublicationAuthorToApi(a))
    return response.ok({ success: true, data })
  }

  /** PUT /api/admin/publications/:id/authors */
  async update({ params, request, response }: HttpContext) {
    const pubId = Number(params.id)
    if (!Number.isFinite(pubId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const publication = await this.findPublication(pubId)
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy kết quả NCKH.' })
    }

    prepareAuthorsRequestBody(request)
    const payload = await request.validateUsing(upsertPublicationAuthorsValidator)

    payload.authors = await ScientificProfileAdminService.stripAdminProfilesFromAuthorRows(
      payload.authors
    )

    validateAuthorsListRules(payload.authors)
    validateAdminAuthorsHaveAtLeastOneNcvLink(payload.authors)
    validateManualAuthorGender(payload.authors)

    const incomingIds = new Set(
      payload.authors.map((a) => a.id).filter((id): id is number => id !== undefined && id !== null)
    )

    const existing = await PublicationAuthor.query().where('publication_id', pubId)
    const toDelete = existing.filter((e) => !incomingIds.has(e.id))
    for (const row of toDelete) {
      await row.delete()
    }

    for (const a of payload.authors) {
      const derivedAffType = deriveAffiliationTypeFromUnits(a.affiliation_units)
      const effectiveAffType = derivedAffType ?? a.affiliation_type
      const effectiveMulti = effectiveAffType === 'MIXED'
      const nextProfileId = resolvedProfileIdFromRow(a)
      const nextStudentId = resolvedStudentIdFromRow(a)
      const nextGender = resolvedGenderForSave(a)

      if (a.id != null) {
        const author = await PublicationAuthor.query()
          .where('id', a.id)
          .where('publication_id', pubId)
          .first()
        if (author) {
          author.fullName = a.full_name
          author.affiliationUnits = a.affiliation_units ?? []
          author.authorOrder = a.author_order
          author.isTopAuthor = a.is_top_author
          author.isCorresponding = a.is_corresponding
          author.affiliationType = effectiveAffType
          author.isMultiAffiliationOutsideUdn = effectiveMulti
          author.contributionPercent = a.contribution_percent ?? null
          author.gender = nextGender
          if (nextProfileId !== undefined) {
            author.profileId = nextProfileId
          }
          if (nextStudentId !== undefined) {
            author.studentId = nextStudentId
          }
          await author.save()
          continue
        }
      }

      await PublicationAuthor.create({
        publicationId: pubId,
        profileId: nextProfileId ?? null,
        studentId: nextStudentId ?? null,
        gender: nextGender,
        fullName: a.full_name,
        affiliationUnits: a.affiliation_units ?? [],
        authorOrder: a.author_order,
        isTopAuthor: a.is_top_author,
        isCorresponding: a.is_corresponding,
        affiliationType: effectiveAffType,
        isMultiAffiliationOutsideUdn: effectiveMulti,
        contributionPercent: a.contribution_percent ?? null,
      })
    }

    const savedAuthors = await PublicationAuthor.query()
      .where('publication_id', pubId)
      .preload('profile', (q) => q.select('id', 'gender'))
      .preload('student', (q) => q.select('id', 'gender'))
      .orderBy('author_order', 'asc')

    const adminProfileIdsSaved = await ScientificProfileAdminService.adminProfileIdsAmong(
      savedAuthors.map((a) => a.profileId).filter((id): id is number => id != null)
    )
    const visibleSaved = savedAuthors.filter(
      (a) => a.profileId == null || !adminProfileIdsSaved.has(Number(a.profileId))
    )

    const authorsDisplay = formatAuthorsDisplayFromRows(visibleSaved)
    if (authorsDisplay) {
      publication.authors = authorsDisplay
      await publication.save()
    }

    const data = visibleSaved.map((a) => mapPublicationAuthorToApi(a))
    return response.ok({ success: true, data })
  }
}
