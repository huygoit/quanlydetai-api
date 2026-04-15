import type { HttpContext } from '@adonisjs/core/http'
import ScientificProfile from '#models/scientific_profile'
import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import {
  upsertPublicationAuthorsValidator,
  validateAuthorsListRules,
  dedupeOwnerAuthorRowsForProfile,
  ensureOwnerProfileOnAuthorRows,
  validateOwnerProfileLinked,
} from '#validators/publication_author_validator'

const OTHER_UNIT_LABEL = 'Other Organization (Đơn vị khác)'
const LEGACY_OTHER_UNIT_LABEL = 'Đơn vị khác'

function deriveAffiliationTypeFromUnits(units: string[] | undefined): 'UDN_ONLY' | 'MIXED' | 'OUTSIDE' | null {
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
 * Sub-resource: tác giả của publication (me).
 * GET /api/profile/me/publications/:id/authors — danh sách tác giả.
 * PUT /api/profile/me/publications/:id/authors — upsert danh sách (update theo id, tạo mới, xóa bản ghi không còn trong payload).
 */
export default class PublicationAuthorsController {
  private async getMyProfile(userId: number) {
    return ScientificProfile.findBy('user_id', userId)
  }

  /**
   * GET /api/profile/me/publications/:id/authors
   * Trả danh sách publication_authors theo publication_id (kiểm tra ownership).
   */
  async index({ auth, params, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })

    const pubId = Number(params.id)
    if (!Number.isFinite(pubId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const publication = await Publication.query()
      .where('id', pubId)
      .where('profile_id', profile.id)
      .first()
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy công bố hoặc không thuộc hồ sơ của bạn.' })
    }

    const authors = await PublicationAuthor.query()
      .where('publication_id', pubId)
      .orderBy('author_order', 'asc')

    const data = authors.map((a) => ({
      id: a.id,
      profileId: a.profileId,
      fullName: a.fullName,
      affiliationUnits: a.affiliationUnits ?? [],
      authorOrder: a.authorOrder,
      isMainAuthor: a.isMainAuthor,
      isCorresponding: a.isCorresponding,
      affiliationType: a.affiliationType,
      isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
    }))

    return response.ok({ success: true, data })
  }

  /**
   * PUT /api/profile/me/publications/:id/authors
   * Body (snake_case): { authors: [{ id?, profile_id?, full_name, author_order, is_main_author, is_corresponding, affiliation_type, is_multi_affiliation_outside_udn }] }
   * Upsert: cập nhật theo id (phải thuộc publication này), tạo mới nếu không có id, xóa các bản ghi không còn trong payload.
   * Phải có ít nhất một tác giả gắn profile_id trùng chủ hồ sơ (sau khi server gộp trùng / gắn id); nếu không → 422.
   */
  async update({ auth, params, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })

    const pubId = Number(params.id)
    if (!Number.isFinite(pubId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const publication = await Publication.query()
      .where('id', pubId)
      .where('profile_id', profile.id)
      .first()
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy công bố hoặc không thuộc hồ sơ của bạn.' })
    }

    const payload = await request.validateUsing(upsertPublicationAuthorsValidator)
    dedupeOwnerAuthorRowsForProfile(payload.authors, profile.id, profile.fullName ?? '')
    ensureOwnerProfileOnAuthorRows(payload.authors, profile.id, profile.fullName ?? '')
    validateAuthorsListRules(payload.authors)
    validateOwnerProfileLinked(payload.authors, profile.id)
    const incomingIds = new Set(
      payload.authors.map((a) => a.id).filter((id): id is number => id !== undefined && id !== null)
    )

    // Các bản ghi hiện có thuộc publication này
    const existing = await PublicationAuthor.query().where('publication_id', pubId)
    const toDelete = existing.filter((e) => !incomingIds.has(e.id))

    for (const row of toDelete) {
      await row.delete()
    }

    for (const a of payload.authors) {
      const derivedAffType = deriveAffiliationTypeFromUnits(a.affiliation_units)
      const effectiveAffType = derivedAffType ?? a.affiliation_type
      const effectiveMulti = effectiveAffType === 'MIXED'
      if (a.id != null) {
        const author = await PublicationAuthor.query()
          .where('id', a.id)
          .where('publication_id', pubId)
          .first()
        if (author) {
          author.fullName = a.full_name
          author.affiliationUnits = a.affiliation_units ?? []
          author.authorOrder = a.author_order
          author.isMainAuthor = a.is_main_author
          author.isCorresponding = a.is_corresponding
          author.affiliationType = effectiveAffType
          author.isMultiAffiliationOutsideUdn = effectiveMulti
          author.profileId = a.profile_id ?? null
          await author.save()
          continue
        }
      }
      await PublicationAuthor.create({
        publicationId: pubId,
        profileId: a.profile_id ?? null,
        fullName: a.full_name,
        affiliationUnits: a.affiliation_units ?? [],
        authorOrder: a.author_order,
        isMainAuthor: a.is_main_author,
        isCorresponding: a.is_corresponding,
        affiliationType: effectiveAffType,
        isMultiAffiliationOutsideUdn: effectiveMulti,
      })
    }

    const authors = await PublicationAuthor.query()
      .where('publication_id', pubId)
      .orderBy('author_order', 'asc')
    const data = authors.map((a) => ({
      id: a.id,
      profileId: a.profileId,
      fullName: a.fullName,
      affiliationUnits: a.affiliationUnits ?? [],
      authorOrder: a.authorOrder,
      isMainAuthor: a.isMainAuthor,
      isCorresponding: a.isCorresponding,
      affiliationType: a.affiliationType,
      isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
    }))

    return response.ok({ success: true, data })
  }
}
