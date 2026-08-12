import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ScientificProfile from '#models/scientific_profile'
import Staff from '#models/staff'
import StaffPosition from '#models/staff_position'
import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import ProfileVerifyLog from '#models/profile_verify_log'
import NotificationService from '#services/notification_service'
import { verifyProfileValidator } from '#validators/scientific_profile_validator'
import ProfileController from '#controllers/profile_controller'
import PublicationAccessService from '#services/publication_access_service'
import { mapPublicationAuthorToApi } from '#utils/publication_author_api'
import { parseStaffPositionIds } from '#utils/staff_position_ids'

const profileSerializer = new ProfileController()

/**
 * Danh sách và chi tiết hồ sơ (PHONG_KH, ADMIN). Verify, request-more-info, verify-logs.
 */
export default class ProfilesController {
  /**
   * GET /api/profiles
   * Query: keyword, faculty, degree, academicTitle, mainResearchArea, status,
   *        positionTitle, partyPosition (ID trong chuỗi staffs, join user_id),
   *        sortBy (updatedAt|fullName|positionTitle|faculty|degree), order (asc|desc),
   *        page, perPage
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const keyword = request.input('keyword', '')
    const faculty = request.input('faculty', '')
    const degree = request.input('degree', '')
    const academicTitle = request.input('academicTitle', '')
    const mainResearchArea = request.input('mainResearchArea', '')
    const status = request.input('status', '')
    const positionTitle = String(request.input('positionTitle', '') || '').trim()
    const partyPosition = String(request.input('partyPosition', '') || '').trim()
    const sortBy = String(request.input('sortBy', 'faculty') || 'faculty').trim()
    const orderDir = String(request.input('order', 'asc') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'

    const q = ScientificProfile.query().preload('user', (u) =>
      u.select('id', 'email', 'full_name', 'unit')
    )

    if (keyword) {
      q.where((b) => {
        b.whereILike('scientific_profiles.full_name', `%${keyword}%`)
          .orWhereILike('scientific_profiles.work_email', `%${keyword}%`)
          .orWhereILike('scientific_profiles.organization', `%${keyword}%`)
      })
    }
    if (faculty) q.whereILike('scientific_profiles.faculty', `%${faculty}%`)
    if (degree) q.where('scientific_profiles.degree', degree)
    if (academicTitle) q.where('scientific_profiles.academic_title', academicTitle)
    if (mainResearchArea) q.whereILike('scientific_profiles.main_research_area', `%${mainResearchArea}%`)
    if (status) q.where('scientific_profiles.status', status)

    const applyIdFilter = (
      sub: ReturnType<typeof ScientificProfile.query>,
      column: string,
      idRaw: string
    ) => {
      const pid = Number(idRaw)
      if (!Number.isFinite(pid) || pid <= 0) return
      const id = String(pid)
      sub.where((b: any) => {
        b.where(column, id)
          .orWhere(column, 'like', `${id},%`)
          .orWhere(column, 'like', `%,${id}`)
          .orWhere(column, 'like', `%,${id},%`)
      })
    }

    if (positionTitle || partyPosition) {
      q.whereExists((sub) => {
        sub
          .from('staffs')
          .whereColumn('staffs.user_id', 'scientific_profiles.user_id')
          .whereNotNull('staffs.user_id')
        if (positionTitle) applyIdFilter(sub, 'staffs.position_title', positionTitle)
        if (partyPosition) applyIdFilter(sub, 'staffs.party_position', partyPosition)
      })
    }

    // Sắp xếp — chức vụ theo tên chức vụ đầu tiên trong chuỗi ID
    if (sortBy === 'positionTitle') {
      q.select('scientific_profiles.*')
      q.leftJoin('staffs', 'staffs.user_id', 'scientific_profiles.user_id')
      q.joinRaw(
        `LEFT JOIN staff_positions ON staff_positions.id = NULLIF(split_part(COALESCE(staffs.position_title, ''), ',', 1), '')::bigint`
      )
      q.orderByRaw(`staff_positions.name ${orderDir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`)
      q.orderBy('scientific_profiles.id', 'asc')
    } else if (sortBy === 'fullName') {
      q.orderBy('scientific_profiles.full_name', orderDir)
    } else if (sortBy === 'faculty') {
      q.orderByRaw(
        `scientific_profiles.faculty ${orderDir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`
      )
      q.orderBy('scientific_profiles.id', 'asc')
    } else if (sortBy === 'degree') {
      q.orderByRaw(
        `scientific_profiles.degree ${orderDir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`
      )
      q.orderBy('scientific_profiles.id', 'asc')
    } else {
      q.orderBy('scientific_profiles.updated_at', orderDir)
    }

    const paginated = await q.paginate(page, perPage)
    const rows = paginated.all()

    // Gắn chức vụ từ staffs (1 query / trang)
    const userIds = [
      ...new Set(
        rows
          .map((p) => Number(p.userId))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ]
    const staffByUserId = new Map<number, string | null>()
    if (userIds.length) {
      const staffs = await Staff.query()
        .whereIn('user_id', userIds)
        .select('user_id', 'position_title')
      for (const s of staffs) {
        const uid = Number(s.userId)
        if (!Number.isFinite(uid)) continue
        // Một user một staff — nếu trùng giữ bản ghi đầu
        if (!staffByUserId.has(uid)) staffByUserId.set(uid, s.positionTitle)
      }
    }

    const allPosIds = new Set<number>()
    for (const raw of staffByUserId.values()) {
      for (const id of parseStaffPositionIds(raw)) allPosIds.add(id)
    }
    const nameById = new Map<number, string>()
    if (allPosIds.size) {
      const catalog = await StaffPosition.query()
        .whereIn('id', [...allPosIds])
        .select('id', 'name')
      for (const c of catalog) nameById.set(Number(c.id), c.name)
    }

    const data = rows.map((p) => {
      const uid = Number(p.userId)
      const posRaw = Number.isFinite(uid) ? staffByUserId.get(uid) ?? null : null
      const ids = parseStaffPositionIds(posRaw)
      const label = ids
        .map((id) => nameById.get(id) || `#${id}`)
        .filter(Boolean)
        .join(', ')
      return {
        id: p.id,
        userId: p.userId,
        fullName: p.fullName,
        workEmail: p.workEmail,
        organization: p.organization,
        faculty: p.faculty,
        degree: p.degree,
        academicTitle: p.academicTitle,
        mainResearchArea: p.mainResearchArea,
        status: p.status,
        completeness: p.completeness,
        updatedAt: p.updatedAt.toISO(),
        positionTitle: posRaw,
        positionTitleLabel: label || null,
      }
    })

    return response.ok({
      success: true,
      data,
      meta: {
        total: paginated.total,
        currentPage: paginated.currentPage,
        perPage: paginated.perPage,
        lastPage: paginated.lastPage,
      },
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
        reviewStatus: p.reviewStatus ?? 'NEW',
        correctionReason: p.correctionReason ?? null,
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
    const profile = await ScientificProfile.find(profileId)
    if (!profile) return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ.' })

    const publication = await PublicationAccessService.findViewable(pubId, profileId)
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy công bố hoặc không thuộc hồ sơ này.' })
    }
    const authors = await PublicationAuthor.query()
      .where('publication_id', pubId)
      .preload('profile', (q) => q.select('id', 'gender'))
      .preload('student', (q) => q.select('id', 'gender'))
      .orderBy('author_order', 'asc')
    const data = authors.map((a) => mapPublicationAuthorToApi(a))
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
      .first()
    if (!profile) return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ.' })
    await profileSerializer.attachAccessiblePublications(profile)
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
