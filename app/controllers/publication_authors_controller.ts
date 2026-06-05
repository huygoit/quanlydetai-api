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
  prepareAuthorsRequestBody,
  resolvedProfileIdFromRow,
  resolvedStudentIdFromRow,
} from '#validators/publication_author_validator'
import PublicationAccessService from '#services/publication_access_service'
import { formatAuthorsDisplayFromRows } from '#utils/publication_authors_display'

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

    const publication = await PublicationAccessService.findViewable(pubId, profile.id)
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy công bố hoặc bạn không có quyền xem.' })
    }

    const authors = await PublicationAuthor.query()
      .where('publication_id', pubId)
      .orderBy('author_order', 'asc')

    const data = authors.map((a) => ({
      id: a.id,
      profileId: a.profileId,
      studentId: a.studentId,
      fullName: a.fullName,
      affiliationUnits: a.affiliationUnits ?? [],
      authorOrder: a.authorOrder,
      isTopAuthor: a.isTopAuthor,
      isCorresponding: a.isCorresponding,
      affiliationType: a.affiliationType,
      isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
    }))

    return response.ok({ success: true, data })
  }

  /**
   * PUT /api/profile/me/publications/:id/authors
   * Body (snake_case): { authors: [{ id?, profile_id?, full_name, author_order, is_top_author, is_corresponding, affiliation_type, is_multi_affiliation_outside_udn }] }
   * Upsert: cập nhật theo id (phải thuộc publication này), tạo mới nếu không có id, xóa các bản ghi không còn trong payload.
   * Phải có ít nhất một tác giả gắn profile_id trùng chủ hồ sơ (sau khi server gộp trùng / gắn id); nếu không → 422.
   * Không bắt buộc có tác giả nhóm chính (is_top_author / is_corresponding) khi lưu.
   */
  async update({ auth, params, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })

    const pubId = Number(params.id)
    if (!Number.isFinite(pubId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const publication = await PublicationAccessService.findEditable(pubId, profile.id)
    if (!publication) {
      const viewable = await PublicationAccessService.findViewable(pubId, profile.id)
      if (viewable) {
        return response.forbidden({
          success: false,
          message: 'Chỉ chủ bài kê khai mới được sửa danh sách tác giả.',
        })
      }
      return response.notFound({ success: false, message: 'Không tìm thấy công bố hoặc bạn không có quyền sửa.' })
    }

    prepareAuthorsRequestBody(request)
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
      const nextProfileId = resolvedProfileIdFromRow(a)
      const nextStudentId = resolvedStudentIdFromRow(a)

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
        fullName: a.full_name,
        affiliationUnits: a.affiliation_units ?? [],
        authorOrder: a.author_order,
        isTopAuthor: a.is_top_author,
        isCorresponding: a.is_corresponding,
        affiliationType: effectiveAffType,
        isMultiAffiliationOutsideUdn: effectiveMulti,
      })
    }

    const authors = await PublicationAuthor.query()
      .where('publication_id', pubId)
      .orderBy('author_order', 'asc')

    const authorsDisplay = formatAuthorsDisplayFromRows(authors)
    if (authorsDisplay) {
      publication.authors = authorsDisplay
      await publication.save()
    }

    const data = authors.map((a) => ({
      id: a.id,
      profileId: a.profileId,
      studentId: a.studentId,
      fullName: a.fullName,
      affiliationUnits: a.affiliationUnits ?? [],
      authorOrder: a.authorOrder,
      isTopAuthor: a.isTopAuthor,
      isCorresponding: a.isCorresponding,
      affiliationType: a.affiliationType,
      isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
    }))

    return response.ok({ success: true, data })
  }
}
