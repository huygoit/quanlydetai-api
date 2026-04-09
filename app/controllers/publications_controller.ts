import type { HttpContext } from '@adonisjs/core/http'
import ScientificProfile from '#models/scientific_profile'
import Publication from '#models/publication'
import { createPublicationValidator } from '#validators/publication_validator'
import { updatePublicationValidator } from '#validators/publication_validator'
import PublicationResearchTypeService from '#services/publication_research_type_service'

/**
 * Sub-resource: publications của hồ sơ me (GET/POST /api/profile/me/publications, PUT/DELETE /:id).
 */
export default class PublicationsController {
  private async getMyProfile(userId: number) {
    return ScientificProfile.findBy('user_id', userId)
  }

  private serializePublication(p: Publication) {
    return {
      id: p.id,
      title: p.title,
      authors: p.authors,
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
      year: p.year,
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
      publicationStatus: p.publicationStatus,
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

    const q = Publication.query()
      .where('profile_id', profile.id)
      .preload('researchOutputType')
      .orderBy('year', 'desc')
      .orderBy('id', 'desc')
    if (publicationType) q.where('publication_type', publicationType)
    if (rank) q.where('rank', rank)
    if (year) q.where('year', year)
    const paginated = await q.paginate(page, perPage)
    const data = paginated.all().map((p) => this.serializePublication(p))
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

    const pub = await Publication.create({
      profileId: profile.id,
      researchOutputTypeId: payload.researchOutputTypeId,
      title: payload.title,
      authors: payload.authors,
      correspondingAuthor: payload.correspondingAuthor ?? null,
      myRole: payload.myRole ?? null,
      publicationType: payload.publicationType ?? 'JOURNAL',
      journalOrConference: payload.journalOrConference,
      year: payload.year ?? null,
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
      publicationStatus: payload.publicationStatus,
      source: 'INTERNAL',
      verifiedByNcv: false,
      approvedInternal: null,
      attachmentUrl: payload.attachmentUrl ?? null,
    })
    await pub.load('researchOutputType')
    await this.updateProfileCompleteness(profile.id)
    return response.created({
      success: true,
      data: this.serializePublication(pub),
    })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const pub = await Publication.query()
      .where('id', params.id)
      .where('profile_id', profile.id)
      .first()
    if (!pub) return response.notFound({ success: false, message: 'Không tìm thấy công bố.' })
    const payload = await request.validateUsing(updatePublicationValidator)

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
    if (payload.year !== undefined) updates.year = payload.year ?? null
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
    if (payload.publicationStatus !== undefined) updates.publicationStatus = payload.publicationStatus
    if (payload.attachmentUrl !== undefined) updates.attachmentUrl = payload.attachmentUrl ?? null
    pub.merge(updates)
    await pub.save()
    await pub.load('researchOutputType')
    await this.updateProfileCompleteness(profile.id)
    return response.ok({ success: true, data: this.serializePublication(pub) })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const pub = await Publication.query().where('id', params.id).where('profile_id', profile.id).first()
    if (!pub) return response.notFound({ success: false, message: 'Không tìm thấy công bố.' })
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
