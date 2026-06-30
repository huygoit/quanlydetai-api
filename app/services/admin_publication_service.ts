import { DateTime } from 'luxon'
import Publication from '#models/publication'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import ResearchOutputType from '#models/research_output_type'
import ScientificProfile from '#models/scientific_profile'
import { formatPublishedAtForResponse, PUBLICATION_EFFECTIVE_DATE_EXPR } from '#utils/publication_date_helper'
import { resolvePublicationAuthorsDisplay } from '#utils/publication_authors_display'

export type AdminPublicationListFilters = {
  page?: number
  perPage?: number
  keyword?: string
  rootTypeId?: number
  profileId?: number
  publishedFrom?: string
  publishedTo?: string
  reviewStatus?: string
}

export default class AdminPublicationService {
  /** Gom id loại lá thuộc nhóm gốc (gồm cả node gốc và toàn bộ con cháu). */
  static async collectDescendantTypeIds(rootId: number): Promise<number[]> {
    const all = await ResearchOutputType.query().select('id', 'parentId')
    const childrenByParent = new Map<number, number[]>()
    for (const row of all) {
      const pid = row.parentId != null ? Number(row.parentId) : null
      if (pid != null && Number.isFinite(pid)) {
        const id = Number(row.id)
        const list = childrenByParent.get(pid) ?? []
        list.push(id)
        childrenByParent.set(pid, list)
      }
    }
    const ids: number[] = []
    const stack = [Number(rootId)]
    while (stack.length) {
      const id = stack.pop()!
      ids.push(id)
      const kids = childrenByParent.get(id) ?? []
      stack.push(...kids)
    }
    return ids
  }

  static serializeAdminPublication(p: Publication) {
    const profile = p.profile
    return {
      id: p.id,
      profileId: p.profileId,
      profileFullName: profile?.fullName ?? null,
      profileFaculty: profile?.faculty ?? profile?.department ?? null,
      profileWorkEmail: profile?.workEmail ?? null,
      isOwner: false,
      canEdit: true,
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
      verifiedByNcv: p.verifiedByNcv,
      approvedInternal: p.approvedInternal,
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt?.toISO() ?? null,
    }
  }

  static buildListQuery(
    filters: AdminPublicationListFilters,
    rootTypeIds?: number[]
  ): ModelQueryBuilderContract<typeof Publication, Publication> {
    const q = Publication.query()
      .preload('researchOutputType')
      .preload('profile')
      .preload('publicationAuthors', (pa) => pa.orderBy('author_order', 'asc'))
      .orderBy('published_at', 'desc')
      .orderBy('year', 'desc')
      .orderBy('id', 'desc')

    if (filters.profileId != null && Number.isFinite(filters.profileId)) {
      q.where('profile_id', filters.profileId)
    }

    if (rootTypeIds != null) {
      if (rootTypeIds.length > 0) {
        q.whereIn('research_output_type_id', rootTypeIds)
      } else {
        q.whereRaw('1 = 0')
      }
    }

    // keyword có thể tới dạng mảng (?keyword[]=...) hoặc số — ép an toàn về chuỗi.
    const kwRaw = Array.isArray(filters.keyword) ? filters.keyword[0] : filters.keyword
    const kw = kwRaw == null ? '' : String(kwRaw).trim()
    if (kw) {
      const like = `%${kw}%`
      q.where((b) => {
        b.whereILike('title', like)
          .orWhereILike('authors', like)
          .orWhereHas('profile', (pq) => {
            pq.whereILike('full_name', like)
          })
      })
    }

    if (filters.publishedFrom) {
      const from = DateTime.fromISO(filters.publishedFrom)
      if (from.isValid) {
        q.whereRaw(`${PUBLICATION_EFFECTIVE_DATE_EXPR} >= ?`, [from.toISODate()!])
      }
    }

    if (filters.publishedTo) {
      const to = DateTime.fromISO(filters.publishedTo)
      if (to.isValid) {
        q.whereRaw(`${PUBLICATION_EFFECTIVE_DATE_EXPR} <= ?`, [to.toISODate()!])
      }
    }

    const reviewStatus = filters.reviewStatus?.trim()
    if (reviewStatus) {
      q.where('review_status', reviewStatus)
    }

    return q
  }

  static async findByIdOrFail(id: number) {
    return Publication.query()
      .where('id', id)
      .preload('researchOutputType')
      .preload('profile')
      .preload('publicationAuthors', (pa) => pa.orderBy('author_order', 'asc'))
      .first()
  }

  static async ensureProfileExists(profileId: number) {
    return ScientificProfile.find(profileId)
  }

  static async updateProfileCompleteness(profileId: number | null | undefined) {
    if (profileId == null || !Number.isFinite(profileId)) return
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
