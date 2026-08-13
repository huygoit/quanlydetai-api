import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ScientificProfile from '#models/scientific_profile'
import Publication from '#models/publication'
import { createPublicationValidator } from '#validators/publication_validator'
import { updatePublicationValidator } from '#validators/publication_validator'
import PublicationResearchTypeService from '#services/publication_research_type_service'
import {
  formatPublishedAtForResponse,
  resolvePublicationDatesForCreate,
  resolvePublicationDatesForUpdate,
} from '#utils/publication_date_helper'
import PublicationAccessService from '#services/publication_access_service'
import NotificationService from '#services/notification_service'
import { resolvePublicationAuthorsDisplay } from '#utils/publication_authors_display'

/**
 * Sub-resource: publications của hồ sơ me (GET/POST /api/profile/me/publications, PUT/DELETE /:id).
 */
export default class PublicationsController {
  private async getMyProfile(userId: number) {
    return ScientificProfile.findBy('user_id', userId)
  }

  private serializePublication(p: Publication, viewerProfileId: number) {
    const isOwner = PublicationAccessService.isOwner(p, viewerProfileId)
    return {
      id: p.id,
      isOwner,
      canEdit: isOwner,
      title: p.title,
      authors: resolvePublicationAuthorsDisplay(p),
      correspondingAuthor: p.correspondingAuthor,
      myRole: p.myRole,
      researchOutputTypeId: p.researchOutputTypeId,
      researchOutputType: p.researchOutputType
        ? {
            id: p.researchOutputType.id,
            code: p.researchOutputType.code,
            name: p.researchOutputType.name,
            level: p.researchOutputType.level,
          }
        : null,
      publicationType: p.publicationType,
      journalOrConference: p.journalOrConference,
      publisher: p.publisher,
      fundingOrganization: p.fundingOrganization,
      year: p.year,
      publishedAt: formatPublishedAtForResponse(p.publishedAt),
      published_at: formatPublishedAtForResponse(p.publishedAt),
      volume: p.volume,
      issue: p.issue,
      pages: p.pages,
      rank: p.rank,
      quartile: p.quartile,
      academicYear: p.academicYear,
      domesticRuleType: p.domesticRuleType,
      hdgsnnScore: p.hdgsnnScore != null ? Number(p.hdgsnnScore) : null,
      doi: p.doi,
      issn: p.issn,
      isbn: p.isbn,
      url: p.url,
      qRankUrl: p.qRankUrl,
      reputableListUrl: p.reputableListUrl,
      acceptanceGrade: p.acceptanceGrade ?? null,
      publicationStatus: p.publicationStatus,
      reviewStatus: p.reviewStatus ?? 'NEW',
      correctionReason: p.correctionReason ?? null,
      source: p.source,
      sourceId: p.sourceId,
      needsIndexConfirmation: p.needsIndexConfirmation,
      indexMappedCode: p.indexMappedCode,
      indexMappingReason: p.indexMappingReason,
      attachmentUrl: p.attachmentUrl,
      createdAt: p.createdAt.toISO(),
    }
  }

  async index({ auth, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const publicationType = request.input('publicationType', '')
    const rank = request.input('rank', '')
    const year = request.input('year', '')

    const q = PublicationAccessService.accessiblePublicationsQuery(profile.id)
      .preload('researchOutputType')
      .preload('publicationAuthors', (pa) => pa.orderBy('author_order', 'asc'))
      .orderBy('year', 'desc')
      .orderBy('id', 'desc')
    if (publicationType) q.where('publication_type', publicationType)
    if (rank) q.where('rank', rank)
    if (year) q.where('year', year)
    const paginated = await q.paginate(page, perPage)
    const data = paginated.all().map((p) => this.serializePublication(p, profile.id))
    return response.ok({
      success: true,
      data,
      meta: { total: paginated.total, currentPage: paginated.currentPage, perPage: paginated.perPage, lastPage: paginated.lastPage },
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const payload = await request.validateUsing(createPublicationValidator)

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
      const existed = await Publication.query()
        .where('profile_id', profile.id)
        .where('source', payload.source)
        .where('source_id', payload.sourceId)
        .first()
      if (existed) {
        await existed.load('researchOutputType')
        return response.ok({
          success: true,
          message: 'Bài báo đã tồn tại theo nguồn import, trả về bản ghi hiện có.',
          data: this.serializePublication(existed, profile.id),
        })
      }
    }

    const pub = await Publication.create({
      profileId: profile.id,
      researchOutputTypeId: payload.researchOutputTypeId,
      title: payload.title,
      authors: payload.authors,
      correspondingAuthor: payload.correspondingAuthor ?? null,
      myRole: payload.myRole ?? null,
      publicationType: payload.publicationType ?? 'JOURNAL',
      journalOrConference: payload.journalOrConference,
      publisher: payload.publisher ?? null,
      fundingOrganization: payload.fundingOrganization ?? null,
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
      verifiedByNcv: false,
      approvedInternal: null,
      attachmentUrl: payload.attachmentUrl ?? null,
    })
    await pub.load('researchOutputType')
    await this.updateProfileCompleteness(profile.id)
    return response.created({
      success: true,
      data: this.serializePublication(pub, profile.id),
    })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const pub = await PublicationAccessService.findEditable(Number(params.id), profile.id)
    if (!pub) {
      const viewable = await PublicationAccessService.findViewable(Number(params.id), profile.id)
      if (viewable) {
        return response.forbidden({
          success: false,
          message: 'Chỉ chủ bài kê khai mới được sửa công bố.',
        })
      }
      return response.notFound({ success: false, message: 'Không tìm thấy công bố.' })
    }
    const payload = await request.validateUsing(updatePublicationValidator)

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
    if (payload.researchOutputTypeId !== undefined) updates.researchOutputTypeId = payload.researchOutputTypeId
    if (payload.title !== undefined) updates.title = payload.title
    if (payload.authors !== undefined) updates.authors = payload.authors
    if (payload.correspondingAuthor !== undefined) updates.correspondingAuthor = payload.correspondingAuthor ?? null
    if (payload.myRole !== undefined) updates.myRole = payload.myRole ?? null
    if (payload.publicationType !== undefined) updates.publicationType = payload.publicationType
    if (payload.journalOrConference !== undefined) updates.journalOrConference = payload.journalOrConference
    if (payload.publisher !== undefined) updates.publisher = payload.publisher ?? null
    if (payload.fundingOrganization !== undefined)
      updates.fundingOrganization = payload.fundingOrganization ?? null
    if (dateUpdates.publishedAt !== undefined) updates.publishedAt = dateUpdates.publishedAt
    if (dateUpdates.year !== undefined) updates.year = dateUpdates.year
    if (payload.volume !== undefined) updates.volume = payload.volume ?? null
    if (payload.issue !== undefined) updates.issue = payload.issue ?? null
    if (payload.pages !== undefined) updates.pages = payload.pages ?? null
    if (payload.rank !== undefined) updates.rank = payload.rank ?? null
    if (payload.quartile !== undefined) updates.quartile = payload.quartile ?? null
    if (payload.academicYear !== undefined) updates.academicYear = payload.academicYear ?? null
    if (payload.domesticRuleType !== undefined) updates.domesticRuleType = payload.domesticRuleType ?? null
    if (payload.hdgsnnScore !== undefined) updates.hdgsnnScore = payload.hdgsnnScore ?? null
    if (payload.doi !== undefined) updates.doi = payload.doi ?? null
    if (payload.issn !== undefined) updates.issn = payload.issn ?? null
    if (payload.isbn !== undefined) updates.isbn = payload.isbn ?? null
    if (payload.url !== undefined) updates.url = payload.url ?? null
    if (payload.qRankUrl !== undefined) updates.qRankUrl = payload.qRankUrl ?? null
    if (payload.reputableListUrl !== undefined)
      updates.reputableListUrl = payload.reputableListUrl ?? null
    if (payload.acceptanceGrade !== undefined) updates.acceptanceGrade = payload.acceptanceGrade ?? null
    if (payload.publicationStatus !== undefined) updates.publicationStatus = payload.publicationStatus
    if (payload.source !== undefined) updates.source = payload.source
    if (payload.sourceId !== undefined) updates.sourceId = payload.sourceId ?? null
    if (payload.needsIndexConfirmation !== undefined)
      updates.needsIndexConfirmation = payload.needsIndexConfirmation
    if (payload.indexMappedCode !== undefined) updates.indexMappedCode = payload.indexMappedCode ?? null
    if (payload.indexMappingReason !== undefined)
      updates.indexMappingReason = payload.indexMappingReason ?? null
    if (payload.attachmentUrl !== undefined) updates.attachmentUrl = payload.attachmentUrl ?? null

    // Người kê khai lưu khi đang bị yêu cầu hiệu chỉnh → chuyển sang Đã hiệu chỉnh
    const vuaHieuChinh = pub.reviewStatus === 'CORRECTION_REQUESTED'
    if (vuaHieuChinh) {
      updates.reviewStatus = 'CORRECTED'
      updates.correctionReason = null
    }

    pub.merge(updates)
    await pub.save()
    await pub.load('researchOutputType')
    await this.updateProfileCompleteness(profile.id)

    if (vuaHieuChinh) {
      const title = (updates.title as string | undefined) ?? pub.title
      await NotificationService.notifyPublicationCorrected(
        pub.id,
        title,
        profile.fullName || 'Người kê khai'
      )
    }

    return response.ok({ success: true, data: this.serializePublication(pub, profile.id) })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const pub = await PublicationAccessService.findEditable(Number(params.id), profile.id)
    if (!pub) {
      const viewable = await PublicationAccessService.findViewable(Number(params.id), profile.id)
      if (viewable) {
        return response.forbidden({
          success: false,
          message: 'Chỉ chủ bài kê khai mới được xóa công bố.',
        })
      }
      return response.notFound({ success: false, message: 'Không tìm thấy công bố.' })
    }
    await pub.delete()
    await this.updateProfileCompleteness(profile.id)
    return response.ok({ success: true, message: 'Đã xóa.' })
  }

  private async updateProfileCompleteness(profileId: number) {
    const profile = await ScientificProfile.query()
      .where('id', profileId)
      .preload('languages')
      .preload('publications')
      .first()
    if (profile) {
      profile.completeness = ScientificProfile.calculateCompleteness({
        ...profile.toJSON(),
        languages: profile.languages,
        publications: profile.publications,
      })
      await profile.save()
    }
  }
}
