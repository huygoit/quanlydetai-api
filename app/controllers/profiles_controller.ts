import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ScientificProfile from '#models/scientific_profile'
import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import ProfileVerifyLog from '#models/profile_verify_log'
import NotificationService from '#services/notification_service'
import { verifyProfileValidator } from '#validators/scientific_profile_validator'
import ProfileController from '#controllers/profile_controller'

const profileSerializer = new ProfileController()

/**
 * Danh sách và chi tiết hồ sơ (PHONG_KH, ADMIN). Verify, request-more-info, verify-logs.
 */
export default class ProfilesController {
  /**
   * GET /api/profiles - keyword, faculty, degree, mainResearchArea, status, page, perPage
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const keyword = request.input('keyword', '')
    const faculty = request.input('faculty', '')
    const degree = request.input('degree', '')
    const mainResearchArea = request.input('mainResearchArea', '')
    const status = request.input('status', '')

    const q = ScientificProfile.query()
      .preload('user', (u) => u.select('id', 'email', 'full_name', 'unit'))
      .orderBy('updated_at', 'desc')

    if (keyword) {
      q.where((b) => {
        b.whereILike('full_name', `%${keyword}%`)
          .orWhereILike('work_email', `%${keyword}%`)
          .orWhereILike('organization', `%${keyword}%`)
      })
    }
    if (faculty) q.whereILike('faculty', `%${faculty}%`)
    if (degree) q.where('degree', degree)
    if (mainResearchArea) q.whereILike('main_research_area', `%${mainResearchArea}%`)
    if (status) q.where('status', status)

    const paginated = await q.paginate(page, perPage)
    const data = paginated.all().map((p) => ({
      id: p.id,
      userId: p.userId,
      fullName: p.fullName,
      workEmail: p.workEmail,
      organization: p.organization,
      faculty: p.faculty,
      degree: p.degree,
      mainResearchArea: p.mainResearchArea,
      status: p.status,
      completeness: p.completeness,
      updatedAt: p.updatedAt.toISO(),
    }))
    return response.ok({
      success: true,
      data,
      meta: { total: paginated.total, currentPage: paginated.currentPage, perPage: paginated.perPage, lastPage: paginated.lastPage },
    })
  }

  /**
   * GET /api/profiles/:id/publications — danh sách công bố của hồ sơ (read-only, PHONG_KH/ADMIN).
   */
  async profilePublications({ params, response }: HttpContext) {
    const profileId = Number(params.id)
    if (!Number.isFinite(profileId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }
    const profile = await ScientificProfile.find(profileId)
    if (!profile) return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ.' })
    const publications = await Publication.query()
      .where('profile_id', profileId)
      .preload('researchOutputType')
      .orderBy('year', 'desc')
      .orderBy('id', 'desc')
    const data = publications.map((p) => {
      const rot = p.researchOutputType
      return {
        id: p.id,
        title: p.title,
        year: p.year,
        rank: p.rank,
        quartile: p.quartile,
        academicYear: p.academicYear,
        researchOutputTypeId: p.researchOutputTypeId,
        researchOutputType: rot ? { id: rot.id, code: rot.code, name: rot.name } : null,
        publicationType: p.publicationType,
        publicationStatus: p.publicationStatus,
      }
    })
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/profiles/:id/publications/:pubId/authors — danh sách tác giả của một công bố (read-only, PHONG_KH/ADMIN).
   */
  async profilePublicationAuthors({ params, response }: HttpContext) {
    const profileId = Number(params.id)
    const pubId = Number(params.pubId)
    if (!Number.isFinite(profileId) || !Number.isFinite(pubId)) {
      return response.badRequest({ success: false, message: 'id hoặc pubId không hợp lệ.' })
    }
    const publication = await Publication.query()
      .where('id', pubId)
      .where('profile_id', profileId)
      .first()
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy công bố hoặc không thuộc hồ sơ này.' })
    }
    const authors = await PublicationAuthor.query()
      .where('publication_id', pubId)
      .orderBy('author_order', 'asc')
    const data = authors.map((a) => ({
      id: a.id,
      profileId: a.profileId,
      fullName: a.fullName,
      authorOrder: a.authorOrder,
      isMainAuthor: a.isMainAuthor,
      isCorresponding: a.isCorresponding,
      affiliationType: a.affiliationType,
      isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
    }))
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/profiles/:id - chi tiết đầy đủ (có languages, attachments, publications)
   */
  async show({ params, response }: HttpContext) {
    const profile = await ScientificProfile.query()
      .where('id', params.id)
      .preload('languages')
      .preload('attachments')
      .preload('publications', (q) => q.preload('researchOutputType'))
      .first()
    if (!profile) return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ.' })
    return response.ok({ success: true, data: profileSerializer.serializeProfile(profile) })
  }

  /**
   * POST /api/profiles/:id/verify - xác thực hồ sơ, gửi thông báo NCV
   */
  async verify(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const user = auth.use('api').user!
    const profile = await ScientificProfile.find(params.id)
    if (!profile) return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ.' })
    const payload = await request.validateUsing(verifyProfileValidator)
    profile.status = 'VERIFIED'
    profile.verifiedAt = DateTime.now()
    profile.verifiedBy = user.fullName
    profile.needMoreInfoReason = null
    await profile.save()
    await ProfileVerifyLog.create({
      profileId: profile.id,
      action: 'VERIFY',
      note: payload.note ?? null,
      actorRole: user.role,
      actorName: user.fullName,
    })
    await NotificationService.notifyProfileVerified(profile.userId)
    await profile.load((loader) =>
      loader.load('languages').load('attachments').load('publications', (q) => q.preload('researchOutputType'))
    )
    return response.ok({ success: true, message: 'Đã xác thực hồ sơ.', data: profileSerializer.serializeProfile(profile) })
  }

  /**
   * POST /api/profiles/:id/request-more-info - yêu cầu bổ sung, gửi thông báo NCV
   */
  async requestMoreInfo(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const user = auth.use('api').user!
    const profile = await ScientificProfile.find(params.id)
    if (!profile) return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ.' })
    const payload = await request.validateUsing(verifyProfileValidator)
    const reason = payload.note ?? 'Yêu cầu bổ sung thông tin.'
    profile.status = 'NEED_MORE_INFO'
    profile.needMoreInfoReason = reason
    await profile.save()
    await ProfileVerifyLog.create({
      profileId: profile.id,
      action: 'REQUEST_MORE_INFO',
      note: reason,
      actorRole: user.role,
      actorName: user.fullName,
    })
    await NotificationService.notifyNeedMoreInfo(profile.userId, reason)
    await profile.load((loader) =>
      loader.load('languages').load('attachments').load('publications', (q) => q.preload('researchOutputType'))
    )
    return response.ok({ success: true, message: 'Đã gửi yêu cầu bổ sung.', data: profileSerializer.serializeProfile(profile) })
  }

  /**
   * GET /api/profiles/:id/verify-logs
   */
  async verifyLogs({ params, response }: HttpContext) {
    const list = await ProfileVerifyLog.query().where('profile_id', params.id).orderBy('created_at', 'desc')
    const data = list.map((l) => ({
      id: l.id,
      action: l.action,
      note: l.note,
      actorRole: l.actorRole,
      actorName: l.actorName,
      createdAt: l.createdAt.toISO(),
    }))
    return response.ok({ success: true, data })
  }
}
