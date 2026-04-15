import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ScientificProfile from '#models/scientific_profile'
import ProfileLanguage from '#models/profile_language'
import ProfileAttachment from '#models/profile_attachment'
import Publication from '#models/publication'
import Catalog from '#models/catalog'
import NotificationService from '#services/notification_service'
import ResearchOutputTypeService from '#services/research_output_type_service'
import OpenAlexService from '#services/openalex_service'
import { createProfileValidator } from '#validators/scientific_profile_validator'
import { updateProfileValidator } from '#validators/scientific_profile_validator'

/**
 * Hồ sơ của bản thân (NCV): GET/POST/PUT /api/profile/me, POST submit.
 */
export default class ProfileController {
  /**
   * Lấy profile của user hiện tại (hoặc 404).
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const profile = await ScientificProfile.query()
      .where('user_id', user.id)
      .preload('languages')
      .preload('attachments')
      .preload('publications', (q) => q.preload('researchOutputType'))
      .first()
    if (!profile) {
      return response.ok({ success: true, data: null })
    }
    return response.ok({ success: true, data: this.serializeProfile(profile) })
  }

  /**
   * Tạo hồ sơ mới (nếu chưa có).
   */
  async storeMe({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    let profile = await ScientificProfile.query()
      .where('user_id', user.id)
      .preload('languages')
      .preload('attachments')
      .preload('publications', (q) => q.preload('researchOutputType'))
      .first()
    if (profile) {
      return response.ok({ success: true, data: this.serializeProfile(profile) })
    }
    const payload = await request.validateUsing(createProfileValidator)
    profile = await ScientificProfile.create({
      userId: user.id,
      fullName: payload.fullName,
      workEmail: payload.workEmail,
      organization: payload.organization,
      status: 'DRAFT',
      completeness: ScientificProfile.calculateCompleteness({
        fullName: payload.fullName,
        workEmail: payload.workEmail,
        organization: payload.organization,
      }),
    })
    await profile.load((loader) =>
      loader.load('languages').load('attachments').load('publications', (q) => q.preload('researchOutputType'))
    )
    return response.created({ success: true, data: this.serializeProfile(profile) })
  }

  /**
   * Cập nhật hồ sơ và tính lại completeness.
   */
  async updateMe({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const profile = await ScientificProfile.query()
      .where('user_id', user.id)
      .preload('languages')
      .preload('attachments')
      .preload('publications', (q) => q.preload('researchOutputType'))
      .first()
    if (!profile) {
      return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    }
    const payload = await request.validateUsing(updateProfileValidator)
    const updates: Record<string, unknown> = {}
    if (payload.fullName !== undefined) updates.fullName = payload.fullName
    if (payload.dateOfBirth !== undefined)
      updates.dateOfBirth = payload.dateOfBirth ? DateTime.fromISO(payload.dateOfBirth) : null
    if (payload.gender !== undefined) updates.gender = payload.gender ?? null
    if (payload.workEmail !== undefined) updates.workEmail = payload.workEmail
    if (payload.phone !== undefined) updates.phone = payload.phone ?? null
    if (payload.orcid !== undefined) updates.orcid = payload.orcid ?? null
    if (payload.googleScholarUrl !== undefined) updates.googleScholarUrl = payload.googleScholarUrl ?? null
    if (payload.scopusId !== undefined) updates.scopusId = payload.scopusId ?? null
    if (payload.researchGateUrl !== undefined) updates.researchGateUrl = payload.researchGateUrl ?? null
    if (payload.personalWebsite !== undefined) updates.personalWebsite = payload.personalWebsite ?? null
    if (payload.avatarUrl !== undefined) updates.avatarUrl = payload.avatarUrl ?? null
    if (payload.bio !== undefined) updates.bio = payload.bio ?? null
    if (payload.organization !== undefined) updates.organization = payload.organization
    if (payload.faculty !== undefined) updates.faculty = payload.faculty ?? null
    if (payload.department !== undefined) updates.department = payload.department ?? null
    if (payload.currentTitle !== undefined) updates.currentTitle = payload.currentTitle ?? null
    if (payload.managementRole !== undefined) updates.managementRole = payload.managementRole ?? null
    if (payload.startWorkingAt !== undefined)
      updates.startWorkingAt = payload.startWorkingAt ? DateTime.fromISO(payload.startWorkingAt) : null
    if (payload.degree !== undefined) updates.degree = payload.degree ?? null
    if (payload.academicTitle !== undefined) updates.academicTitle = payload.academicTitle ?? null
    if (payload.degreeYear !== undefined) updates.degreeYear = payload.degreeYear ?? null
    if (payload.degreeInstitution !== undefined) updates.degreeInstitution = payload.degreeInstitution ?? null
    if (payload.degreeCountry !== undefined) updates.degreeCountry = payload.degreeCountry ?? null
    if (payload.mainResearchArea !== undefined) updates.mainResearchArea = payload.mainResearchArea ?? null
    if (payload.subResearchAreas !== undefined) updates.subResearchAreas = payload.subResearchAreas ?? []
    if (payload.keywords !== undefined) updates.keywords = payload.keywords ?? []
    profile.merge(updates)
    await profile.save()
    profile.completeness = ScientificProfile.calculateCompleteness({
      ...profile.toJSON(),
      languages: profile.languages,
      publications: profile.publications,
    })
    await profile.save()
    await profile.load((loader) =>
      loader.load('languages').load('attachments').load('publications', (q) => q.preload('researchOutputType'))
    )
    return response.ok({ success: true, data: this.serializeProfile(profile) })
  }

  /**
   * GET /api/profile/me/research-output-types/tree
   * Cây loại kết quả NCKH (chỉ node đang bật) — phục vụ chọn lá khi khai báo công bố.
   */
  async researchOutputTypesTree({ response }: HttpContext) {
    const raw = await ResearchOutputTypeService.getTree()
    const data = this.filterActiveResearchOutputTree(
      raw as Array<{
        id: number
        code: string
        name: string
        level: number
        sortOrder: number
        isActive: boolean
        hasRule: boolean
        ruleKind: string | null
        children: unknown[]
      }>
    )
    return response.ok({ success: true, data })
  }

  private filterActiveResearchOutputTree(
    nodes: Array<{
      id: number
      code: string
      name: string
      level: number
      sortOrder: number
      isActive: boolean
      hasRule: boolean
      ruleKind: string | null
      children: unknown[]
    }>
  ): Array<{
    id: number
    code: string
    name: string
    level: number
    sortOrder: number
    isActive: boolean
    hasRule: boolean
    ruleKind: string | null
    children: ReturnType<ProfileController['filterActiveResearchOutputTree']>
  }> {
    return nodes
      .filter((n) => n.isActive)
      .map((n) => ({
        id: n.id,
        code: n.code,
        name: n.name,
        level: n.level,
        sortOrder: n.sortOrder,
        isActive: n.isActive,
        hasRule: n.hasRule,
        ruleKind: n.ruleKind,
        children: this.filterActiveResearchOutputTree(
          (n.children ?? []) as Parameters<ProfileController['filterActiveResearchOutputTree']>[0]
        ),
      }))
  }

  /**
   * Gửi hồ sơ để xác thực (DRAFT/NEED_MORE_INFO -> UPDATED), gửi thông báo PHONG_KH.
   */
  async submitMe({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const profile = await ScientificProfile.findBy('user_id', user.id)
    if (!profile) {
      return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    }
    if (profile.status !== 'DRAFT' && profile.status !== 'NEED_MORE_INFO') {
      return response.badRequest({
        success: false,
        message: 'Chỉ có thể gửi hồ sơ khi trạng thái là DRAFT hoặc NEED_MORE_INFO.',
      })
    }
    profile.status = 'UPDATED'
    profile.needMoreInfoReason = null
    await profile.save()
    await NotificationService.notifyProfileSubmitted(profile.id, profile.fullName)
    await profile.load((loader) =>
      loader.load('languages').load('attachments').load('publications', (q) => q.preload('researchOutputType'))
    )
    return response.ok({ success: true, message: 'Đã gửi hồ sơ để xác thực.', data: this.serializeProfile(profile) })
  }

  /**
   * GET /api/profile/me/suggestions
   * Trả về dữ liệu gợi ý cho form hồ sơ: danh mục (lĩnh vực, đơn vị, ngôn ngữ), giới tính, học vị, học hàm.
   */
  async suggestions({ response }: HttpContext) {
    const [fields, units, languages] = await Promise.all([
      Catalog.query().where('type', 'FIELD').where('is_active', true).orderBy('sort_order').orderBy('id').select('code', 'name'),
      Catalog.query().where('type', 'UNIT').where('is_active', true).orderBy('sort_order').orderBy('id').select('code', 'name'),
      Catalog.query().where('type', 'LANGUAGE').where('is_active', true).orderBy('sort_order').orderBy('id').select('code', 'name'),
    ])
    const data = {
      genders: [{ code: 'Nam', name: 'Nam' }, { code: 'Nữ', name: 'Nữ' }, { code: 'Khác', name: 'Khác' }],
      degrees: [
        { code: 'Cu_nhan', name: 'Cử nhân' },
        { code: 'Thac_si', name: 'Thạc sĩ' },
        { code: 'Tien_si', name: 'Tiến sĩ' },
        { code: 'Khac', name: 'Khác' },
      ],
      academicTitles: [
        { code: 'Khong', name: 'Không' },
        { code: 'PGS', name: 'PGS' },
        { code: 'GS', name: 'GS' },
      ],
      researchAreas: fields.map((c) => ({ code: c.code, name: c.name })),
      units: units.map((c) => ({ code: c.code, name: c.name })),
      languages: languages.map((c) => ({ code: c.code, name: c.name })),
    }
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/profile/me/author-profiles-lookup?q=&limit=
   * Gợi ý hồ sơ khoa học nội bộ để gắn profile_id khi khai báo tác giả công bố (không cần quyền profile.view_all).
   */
  async authorProfilesLookup({ request, response }: HttpContext) {
    const q = String(request.input('q', '')).trim()
    const limitRaw = Number(request.input('limit', 20))
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 50)
    if (q.length < 2) {
      return response.ok({ success: true, data: [] })
    }
    const like = `%${q}%`
    const rows = await ScientificProfile.query()
      .where((b) => {
        b.whereILike('full_name', like)
          .orWhereILike('work_email', like)
          .orWhereILike('organization', like)
          .orWhereILike('faculty', like)
          .orWhereILike('department', like)
      })
      .orderBy('full_name', 'asc')
      .limit(limit)
      .select('id', 'full_name', 'work_email', 'organization', 'faculty', 'department', 'status')

    const data = rows.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      workEmail: p.workEmail,
      organization: p.organization,
      faculty: p.faculty,
      department: p.department,
      status: p.status,
    }))
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/profile/me/openalex/publication-drafts
   * Lấy danh sách bài báo từ OpenAlex theo ORCID của user đăng nhập và map sang form tạo kết quả NCKH.
   */
  async openAlexPublicationDrafts({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const profile = await ScientificProfile.findBy('user_id', user.id)
    if (!profile) {
      return response.notFound({ success: false, message: 'Chưa có hồ sơ khoa học.' })
    }
    const orcid = String(profile.orcid ?? '').trim()
    if (!orcid) {
      return response.badRequest({
        success: false,
        message: 'Hồ sơ chưa có ORCID. Vui lòng cập nhật ORCID trước khi import từ OpenAlex.',
      })
    }

    const yearRaw = Number(request.input('year'))
    const year = Number.isFinite(yearRaw) ? yearRaw : undefined
    const perPageRaw = Number(request.input('perPage', 20))
    const perPage = Number.isFinite(perPageRaw) ? perPageRaw : 20

    try {
      const drafts = await OpenAlexService.fetchPublicationDraftsByOrcid({
        orcid,
        profileId: profile.id,
        profileFullName: profile.fullName ?? '',
        year,
        perPage,
      })
      return response.ok({ success: true, data: drafts })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error instanceof Error ? error.message : 'Không lấy được dữ liệu từ OpenAlex.',
      })
    }
  }

  /** Dùng chung cho response profile (có thể gọi từ ProfilesController). */
  serializeProfile(p: ScientificProfile) {
    return {
      id: p.id,
      userId: p.userId,
      fullName: p.fullName,
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISODate() : null,
      gender: p.gender,
      workEmail: p.workEmail,
      phone: p.phone,
      orcid: p.orcid,
      googleScholarUrl: p.googleScholarUrl,
      scopusId: p.scopusId,
      researchGateUrl: p.researchGateUrl,
      personalWebsite: p.personalWebsite,
      avatarUrl: p.avatarUrl,
      bio: p.bio,
      organization: p.organization,
      faculty: p.faculty,
      department: p.department,
      currentTitle: p.currentTitle,
      managementRole: p.managementRole,
      startWorkingAt: p.startWorkingAt ? p.startWorkingAt.toISODate() : null,
      degree: p.degree,
      academicTitle: p.academicTitle,
      degreeYear: p.degreeYear,
      degreeInstitution: p.degreeInstitution,
      degreeCountry: p.degreeCountry,
      mainResearchArea: p.mainResearchArea,
      subResearchAreas: p.subResearchAreas ?? [],
      keywords: p.keywords ?? [],
      status: p.status,
      completeness: p.completeness,
      verifiedAt: p.verifiedAt ? p.verifiedAt.toISO() : null,
      verifiedBy: p.verifiedBy,
      needMoreInfoReason: p.needMoreInfoReason,
      languages: (p.languages as ProfileLanguage[] | undefined)?.map((l) => ({
        id: l.id,
        language: l.language,
        level: l.level,
        certificate: l.certificate,
        certificateUrl: l.certificateUrl,
      })) ?? [],
      attachments: (p.attachments as ProfileAttachment[] | undefined)?.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        url: a.url,
        uploadedAt: a.uploadedAt instanceof DateTime ? a.uploadedAt.toISO() : String(a.uploadedAt),
      })) ?? [],
      publications: (p.publications as Publication[] | undefined)?.map((pub) => {
        const rot = pub.researchOutputType
        return {
        id: pub.id,
        title: pub.title,
        authors: pub.authors,
        researchOutputTypeId: pub.researchOutputTypeId,
        researchOutputType: rot ? { id: rot.id, code: rot.code, name: rot.name } : null,
        publicationType: pub.publicationType,
        journalOrConference: pub.journalOrConference,
        year: pub.year,
        publicationStatus: pub.publicationStatus,
        rank: pub.rank,
        quartile: pub.quartile,
        academicYear: pub.academicYear,
        hdgsnnScore: pub.hdgsnnScore != null ? Number(pub.hdgsnnScore) : null,
        doi: pub.doi,
        volume: pub.volume,
        issue: pub.issue,
        pages: pub.pages,
        issn: pub.issn,
        isbn: pub.isbn,
        url: pub.url,
        source: pub.source,
        sourceId: pub.sourceId,
        verifiedByNcv: pub.verifiedByNcv,
        approvedInternal: pub.approvedInternal,
        publicationStatus: pub.publicationStatus,
        createdAt: pub.createdAt.toISO(),
        updatedAt: pub.updatedAt.toISO(),
        }
      }) ?? [],
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt.toISO(),
    }
  }
}
