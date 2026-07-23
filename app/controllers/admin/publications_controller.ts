import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Publication from '#models/publication'
import {
  adminCreatePublicationValidator,
  adminUpdatePublicationValidator,
} from '#validators/admin_publication_validator'
import PublicationResearchTypeService from '#services/publication_research_type_service'
import {
  resolvePublicationDatesForCreate,
  resolvePublicationDatesForUpdate,
} from '#utils/publication_date_helper'
import AdminPublicationService from '#services/admin_publication_service'
import NotificationService from '#services/notification_service'
import ScientificProfile from '#models/scientific_profile'
import { requestPublicationCorrectionValidator } from '#validators/publication_review_validator'

/**
 * Admin / cán bộ được phân quyền: quản lý KQNC toàn hệ thống (không chủ kê khai).
 */
export default class AdminPublicationsController {
  /** GET /api/admin/publications */
  async index({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(
      Number(request.input('perPage') ?? request.input('per_page', 10)) || 10,
      100
    )
    const keywordRaw = request.input('keyword') ?? request.input('q') ?? ''
    const keyword = String(Array.isArray(keywordRaw) ? (keywordRaw[0] ?? '') : keywordRaw)
    const rootTypeIdRaw = request.input('rootTypeId') ?? request.input('root_type_id')
    const profileIdRaw = request.input('profileId') ?? request.input('profile_id')
    const publishedFrom =
      (request.input('publishedFrom') as string) ||
      (request.input('published_from') as string) ||
      ''
    const publishedTo =
      (request.input('publishedTo') as string) ||
      (request.input('published_to') as string) ||
      ''
    const reviewStatus =
      (request.input('reviewStatus') as string) ||
      (request.input('review_status') as string) ||
      ''

    const rootTypeId =
      rootTypeIdRaw != null && rootTypeIdRaw !== '' ? Number(rootTypeIdRaw) : undefined
    const profileId =
      profileIdRaw != null && profileIdRaw !== '' ? Number(profileIdRaw) : undefined

    let rootTypeIds: number[] | undefined
    if (Number.isFinite(rootTypeId)) {
      rootTypeIds = await AdminPublicationService.collectDescendantTypeIds(rootTypeId!)
    }

    const q = AdminPublicationService.buildListQuery(
      {
        page,
        perPage,
        keyword: keyword || undefined,
        profileId: Number.isFinite(profileId) ? profileId : undefined,
        publishedFrom: publishedFrom || undefined,
        publishedTo: publishedTo || undefined,
        reviewStatus: reviewStatus || undefined,
      },
      rootTypeIds
    )

    const paginated = await q.paginate(page, perPage)
    const data = paginated.all().map((p: Publication) =>
      AdminPublicationService.serializeAdminPublication(p)
    )

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

  /** GET /api/admin/publications/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const pub = await AdminPublicationService.findByIdOrFail(id)
    if (!pub) {
      return response.notFound({ success: false, message: 'Không tìm thấy kết quả NCKH.' })
    }

    return response.ok({
      success: true,
      data: AdminPublicationService.serializeAdminPublication(pub),
    })
  }

  /** POST /api/admin/publications — quản lý KQNC (không chủ kê khai; profileId tùy chọn) */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(adminCreatePublicationValidator)

    let profile = null
    if (payload.profileId != null) {
      profile = await AdminPublicationService.ensureProfileExists(payload.profileId)
      if (!profile) {
        return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ khoa học.' })
      }
    }

    let publicationDates: { publishedAt: DateTime | null; year: number | null }
    try {
      publicationDates = resolvePublicationDatesForCreate(payload)
    } catch (e) {
      const code = (e as Error).message
      if (code === 'INVALID_PUBLISHED_AT') {
        return response.unprocessableEntity({
          success: false,
          message: 'publishedAt không hợp lệ (định dạng YYYY-MM-DD).',
        })
      }
      if (code === 'PUBLISHED_AT_FUTURE') {
        return response.unprocessableEntity({
          success: false,
          message: 'Ngày xuất bản không được vượt quá năm hiện tại + 1.',
        })
      }
      throw e
    }

    try {
      await PublicationResearchTypeService.validateLeafWithRule(
        payload.researchOutputTypeId,
        payload.hdgsnnScore,
        payload.isbn
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu loại kết quả không hợp lệ'
      return response.badRequest({ success: false, message: msg })
    }

    if (payload.source && payload.sourceId) {
      const dupQ = Publication.query()
        .where('source', payload.source)
        .where('source_id', payload.sourceId)
      if (profile) {
        dupQ.where('profile_id', profile.id)
      } else {
        dupQ.whereNull('profile_id')
      }
      const existed = await dupQ.first()
      if (existed) {
        await existed.load('researchOutputType')
        await existed.load('profile')
        return response.ok({
          success: true,
          message: 'Bài báo đã tồn tại theo nguồn import, trả về bản ghi hiện có.',
          data: AdminPublicationService.serializeAdminPublication(existed),
        })
      }
    }

    const pub = await Publication.create({
      profileId: profile?.id ?? null,
      researchOutputTypeId: payload.researchOutputTypeId,
      title: payload.title,
      authors: payload.authors,
      correspondingAuthor: payload.correspondingAuthor ?? null,
      myRole: payload.myRole ?? null,
      publicationType: payload.publicationType ?? 'JOURNAL',
      journalOrConference: payload.journalOrConference,
      publisher: payload.publisher ?? null,
      year: publicationDates.year,
      publishedAt: publicationDates.publishedAt,
      volume: payload.volume ?? null,
      issue: payload.issue ?? null,
      pages: payload.pages ?? null,
      rank: payload.rank ?? null,
      quartile: payload.quartile ?? null,
      academicYear: payload.academicYear ?? null,
      domesticRuleType: payload.domesticRuleType ?? null,
      hdgsnnScore: payload.hdgsnnScore ?? null,
      doi: payload.doi ?? null,
      issn: payload.issn ?? null,
      isbn: payload.isbn ?? null,
      url: payload.url ?? null,
      qRankUrl: payload.qRankUrl ?? null,
      reputableListUrl: payload.reputableListUrl ?? null,
      acceptanceGrade: payload.acceptanceGrade ?? null,
      publicationStatus: payload.publicationStatus,
      reviewStatus: 'NEW',
      correctionReason: null,
      source: payload.source ?? 'INTERNAL',
      sourceId: payload.sourceId ?? null,
      needsIndexConfirmation: payload.needsIndexConfirmation ?? false,
      indexMappedCode: payload.indexMappedCode ?? null,
      indexMappingReason: payload.indexMappingReason ?? null,
      verifiedByNcv: payload.verifiedByNcv ?? false,
      approvedInternal: null,
      attachmentUrl: payload.attachmentUrl ?? null,
    })

    await pub.load('researchOutputType')
    if (profile) {
      await pub.load('profile')
      await AdminPublicationService.updateProfileCompleteness(profile.id)
    }

    return response.created({
      success: true,
      data: AdminPublicationService.serializeAdminPublication(pub),
    })
  }

  /** PUT /api/admin/publications/:id */
  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const pub = await Publication.find(id)
    if (!pub) {
      return response.notFound({ success: false, message: 'Không tìm thấy kết quả NCKH.' })
    }

    const payload = await request.validateUsing(adminUpdatePublicationValidator)
    const prevProfileId = pub.profileId

    if (payload.profileId !== undefined) {
      const profile = await AdminPublicationService.ensureProfileExists(payload.profileId)
      if (!profile) {
        return response.notFound({ success: false, message: 'Không tìm thấy hồ sơ khoa học.' })
      }
    }

    let dateUpdates: ReturnType<typeof resolvePublicationDatesForUpdate> = {}
    try {
      dateUpdates = resolvePublicationDatesForUpdate(payload)
    } catch (e) {
      const code = (e as Error).message
      if (code === 'INVALID_PUBLISHED_AT') {
        return response.unprocessableEntity({
          success: false,
          message: 'publishedAt không hợp lệ (định dạng YYYY-MM-DD).',
        })
      }
      if (code === 'PUBLISHED_AT_FUTURE') {
        return response.unprocessableEntity({
          success: false,
          message: 'Ngày xuất bản không được vượt quá năm hiện tại + 1.',
        })
      }
      throw e
    }

    const nextTypeId = payload.researchOutputTypeId ?? pub.researchOutputTypeId
    const nextHdgsnn = payload.hdgsnnScore !== undefined ? payload.hdgsnnScore : pub.hdgsnnScore
    const nextIsbn = payload.isbn !== undefined ? payload.isbn : pub.isbn
    try {
      await PublicationResearchTypeService.validateLeafWithRule(nextTypeId, nextHdgsnn, nextIsbn)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu loại kết quả không hợp lệ'
      return response.badRequest({ success: false, message: msg })
    }

    const updates: Record<string, unknown> = {}
    if (payload.profileId !== undefined) updates.profileId = payload.profileId
    if (payload.researchOutputTypeId !== undefined)
      updates.researchOutputTypeId = payload.researchOutputTypeId
    if (payload.title !== undefined) updates.title = payload.title
    if (payload.authors !== undefined) updates.authors = payload.authors
    if (payload.correspondingAuthor !== undefined)
      updates.correspondingAuthor = payload.correspondingAuthor ?? null
    if (payload.myRole !== undefined) updates.myRole = payload.myRole ?? null
    if (payload.publicationType !== undefined) updates.publicationType = payload.publicationType
    if (payload.journalOrConference !== undefined)
      updates.journalOrConference = payload.journalOrConference
    if (payload.publisher !== undefined) updates.publisher = payload.publisher ?? null
    if (dateUpdates.publishedAt !== undefined) updates.publishedAt = dateUpdates.publishedAt
    if (dateUpdates.year !== undefined) updates.year = dateUpdates.year
    if (payload.volume !== undefined) updates.volume = payload.volume ?? null
    if (payload.issue !== undefined) updates.issue = payload.issue ?? null
    if (payload.pages !== undefined) updates.pages = payload.pages ?? null
    if (payload.rank !== undefined) updates.rank = payload.rank ?? null
    if (payload.quartile !== undefined) updates.quartile = payload.quartile ?? null
    if (payload.academicYear !== undefined) updates.academicYear = payload.academicYear ?? null
    if (payload.domesticRuleType !== undefined)
      updates.domesticRuleType = payload.domesticRuleType ?? null
    if (payload.hdgsnnScore !== undefined) updates.hdgsnnScore = payload.hdgsnnScore ?? null
    if (payload.doi !== undefined) updates.doi = payload.doi ?? null
    if (payload.issn !== undefined) updates.issn = payload.issn ?? null
    if (payload.isbn !== undefined) updates.isbn = payload.isbn ?? null
    if (payload.url !== undefined) updates.url = payload.url ?? null
    if (payload.qRankUrl !== undefined) updates.qRankUrl = payload.qRankUrl ?? null
    if (payload.reputableListUrl !== undefined)
      updates.reputableListUrl = payload.reputableListUrl ?? null
    if (payload.acceptanceGrade !== undefined) updates.acceptanceGrade = payload.acceptanceGrade ?? null
    if (payload.publicationStatus !== undefined)
      updates.publicationStatus = payload.publicationStatus
    if (payload.source !== undefined) updates.source = payload.source
    if (payload.sourceId !== undefined) updates.sourceId = payload.sourceId ?? null
    if (payload.needsIndexConfirmation !== undefined)
      updates.needsIndexConfirmation = payload.needsIndexConfirmation
    if (payload.indexMappedCode !== undefined)
      updates.indexMappedCode = payload.indexMappedCode ?? null
    if (payload.indexMappingReason !== undefined)
      updates.indexMappingReason = payload.indexMappingReason ?? null
    if (payload.attachmentUrl !== undefined) updates.attachmentUrl = payload.attachmentUrl ?? null
    if (payload.verifiedByNcv !== undefined) updates.verifiedByNcv = payload.verifiedByNcv

    pub.merge(updates)
    await pub.save()
    await pub.load('researchOutputType')
    await pub.load('profile')

    await AdminPublicationService.updateProfileCompleteness(prevProfileId)
    if (payload.profileId !== undefined && payload.profileId !== prevProfileId) {
      await AdminPublicationService.updateProfileCompleteness(payload.profileId)
    }

    return response.ok({
      success: true,
      data: AdminPublicationService.serializeAdminPublication(pub),
    })
  }

  /** DELETE /api/admin/publications/:id */
  async destroy({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const pub = await Publication.find(id)
    if (!pub) {
      return response.notFound({ success: false, message: 'Không tìm thấy kết quả NCKH.' })
    }

    const profileId = pub.profileId
    await pub.delete()
    await AdminPublicationService.updateProfileCompleteness(profileId)

    return response.ok({ success: true, message: 'Đã xóa kết quả NCKH.' })
  }

  /** POST /api/admin/publications/:id/request-correction — yêu cầu hiệu chỉnh */
  async requestCorrection({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const pub = await AdminPublicationService.findByIdOrFail(id)
    if (!pub) {
      return response.notFound({ success: false, message: 'Không tìm thấy kết quả NCKH.' })
    }

    const payload = await request.validateUsing(requestPublicationCorrectionValidator)

    pub.reviewStatus = 'CORRECTION_REQUESTED'
    pub.correctionReason = payload.reason.trim()
    await pub.save()
    await pub.load('researchOutputType')
    await pub.load('profile')

    if (pub.profileId != null) {
      const profile = await ScientificProfile.find(pub.profileId)
      if (profile?.userId) {
        await NotificationService.notifyPublicationCorrectionRequested(
          profile.userId,
          pub.id,
          pub.title,
          pub.correctionReason
        )
      }
    }

    return response.ok({
      success: true,
      message: 'Đã gửi yêu cầu hiệu chỉnh.',
      data: AdminPublicationService.serializeAdminPublication(pub),
    })
  }

  /** POST /api/admin/publications/:id/approve — duyệt kết quả NCKH */
  async approve({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const pub = await AdminPublicationService.findByIdOrFail(id)
    if (!pub) {
      return response.notFound({ success: false, message: 'Không tìm thấy kết quả NCKH.' })
    }

    pub.reviewStatus = 'APPROVED'
    pub.correctionReason = null
    await pub.save()
    await pub.load('researchOutputType')
    await pub.load('profile')

    return response.ok({
      success: true,
      message: 'Đã duyệt kết quả NCKH.',
      data: AdminPublicationService.serializeAdminPublication(pub),
    })
  }
}
