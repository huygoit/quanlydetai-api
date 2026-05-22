import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { normalizeOptionalHttpUrl } from '#utils/optional_http_url'
import ScientificProfile from '#models/scientific_profile'
import ProfileLanguage from '#models/profile_language'
import ProfileAttachment from '#models/profile_attachment'
import Publication from '#models/publication'
import Catalog from '#models/catalog'
import db from '@adonisjs/lucid/services/db'
import NotificationService from '#services/notification_service'
import ResearchOutputTypeService from '#services/research_output_type_service'
import OpenAlexService from '#services/openalex_service'
import { formatPublishedAtForResponse } from '#utils/publication_date_helper'
import PublicationAccessService from '#services/publication_access_service'
import { createProfileValidator } from '#validators/scientific_profile_validator'
import { updateProfileValidator } from '#validators/scientific_profile_validator'
import { listUdnAffiliationUnitsForSelect } from '#constants/udn_affiliation_units'
import {
  resolveDepartmentFields,
  resolveOrganizationFields,
} from '#services/profile_unit_sync_service'
import {
  getScientificProfileAcademicTitleLabel,
  getScientificProfileDegreeLabel,
  listScientificProfileAcademicTitleOptions,
  listScientificProfileDegreeOptions,
  resolveScientificProfileAcademicTitleKey,
  resolveScientificProfileDegreeKey,
} from '#constants/scientific_profile_catalog'

/**
 * Hồ sơ của bản thân (NCV): GET/POST/PUT /api/profile/me, POST submit.
 */
export default class ProfileController {
  private toObject(value: unknown) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    return {}
  }

  private parseMaybeJson(value: unknown): unknown {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    if (!trimmed) return value
    try {
      const once = JSON.parse(trimmed) as unknown
      if (typeof once === 'string') {
        try {
          return JSON.parse(once)
        } catch {
          return once
        }
      }
      return once
    } catch {
      return value
    }
  }

  private normalizeLanguagesInput(source: Record<string, unknown>) {
    const rawLanguages =
      source.languages ??
      source.languageList ??
      source.foreignLanguages ??
      this.toObject(source.data).languages ??
      this.toObject(source.payload).languages ??
      this.toObject(source.profile).languages

    if (rawLanguages === undefined) return undefined

    const parsed = this.parseMaybeJson(rawLanguages)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => this.toObject(item))
      .map((item) => {
        const language = String(item.language ?? item.name ?? item.lang ?? '').trim()
        const levelRaw = item.level == null ? '' : String(item.level).trim()
        const certificateRaw = item.certificate == null ? '' : String(item.certificate).trim()
        const certificateUrlRaw = item.certificateUrl ?? item.certificate_url ?? null
        const certificateUrl = normalizeOptionalHttpUrl(certificateUrlRaw)
        return {
          language,
          // Validator chỉ nhận string hoặc không có field (không nhận null).
          level: levelRaw ? levelRaw : undefined,
          certificate: certificateRaw ? certificateRaw : undefined,
          certificateUrl,
        }
      })
      .filter((item) => item.language !== '')
  }

  private getParsedBody(request: HttpContext['request']) {
    const parsedBody = this.parseMaybeJson(request.body())
    const root = this.toObject(parsedBody)
    const data = this.toObject(root.data)
    const payload = this.toObject(root.payload)
    const profile = this.toObject(root.profile)

    const merged = {
      ...data,
      ...payload,
      ...profile,
      ...root,
    } as Record<string, unknown>

    const normalizedLanguages = this.normalizeLanguagesInput(merged)
    if (normalizedLanguages !== undefined) {
      merged.languages = normalizedLanguages
    }

    return merged
  }

  /** Công bố hiển thị trên hồ sơ: bài chủ + bài đồng tác giả (có profile_id trong publication_authors). */
  private async attachAccessiblePublications(profile: ScientificProfile) {
    const pubs = await PublicationAccessService.accessiblePublicationsQuery(profile.id)
      .preload('researchOutputType')
      .orderBy('year', 'desc')
      .orderBy('id', 'desc')
    profile.$setRelated('publications', pubs)
  }

  private async loadOwnedPublications(profileId: number) {
    return Publication.query().where('profile_id', profileId)
  }

  /**
   * Lấy profile của user hiện tại (hoặc 404).
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const profile = await ScientificProfile.query()
      .where('user_id', user.id)
      .preload('languages')
      .preload('attachments')
      .preload('departmentUnit')
      .first()
    if (!profile) {
      return response.ok({ success: true, data: null })
    }
    await this.attachAccessiblePublications(profile)
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
      .first()
    if (profile) {
      await profile.load('departmentUnit')
      await this.attachAccessiblePublications(profile)
      return response.ok({ success: true, data: this.serializeProfile(profile) })
    }
    const payload = await createProfileValidator.validate(this.getParsedBody(request))
    const orgId = payload.organizationId ?? payload.organization_id
    let orgFields: { organization: string; organizationId: string | null }
    try {
      orgFields = resolveOrganizationFields({
        organization: payload.organization,
        organizationId: orgId,
      })
    } catch (e) {
      const code = (e as Error).message
      if (code === 'ORGANIZATION_REQUIRED') {
        return response.unprocessableEntity({
          success: false,
          message: 'Cần organization hoặc organizationId (cơ quan công tác).',
        })
      }
      if (code === 'INVALID_ORGANIZATION_ID') {
        return response.unprocessableEntity({
          success: false,
          message: 'organizationId không hợp lệ.',
        })
      }
      throw e
    }

    const deptId = payload.departmentId ?? payload.department_id
    let deptFields = { faculty: null as string | null, departmentId: null as number | null }
    if (payload.faculty !== undefined || deptId !== undefined) {
      try {
        deptFields = await resolveDepartmentFields({
          faculty: payload.faculty,
          departmentId: deptId,
        })
      } catch (e) {
        if ((e as Error).message === 'INVALID_DEPARTMENT_ID') {
          return response.unprocessableEntity({
            success: false,
            message: 'departmentId không hợp lệ hoặc không ACTIVE.',
          })
        }
        throw e
      }
    }

    profile = await ScientificProfile.create({
      userId: user.id,
      fullName: payload.fullName,
      workEmail: payload.workEmail,
      organization: orgFields.organization,
      organizationId: orgFields.organizationId,
      faculty: deptFields.faculty,
      departmentId: deptFields.departmentId,
      status: 'DRAFT',
      completeness: ScientificProfile.calculateCompleteness({
        fullName: payload.fullName,
        workEmail: payload.workEmail,
        organization: orgFields.organization,
        faculty: deptFields.faculty,
      }),
    })
    await profile.load((loader) =>
      loader.load('languages').load('attachments').load('departmentUnit')
    )
    await this.attachAccessiblePublications(profile)
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
      .preload('departmentUnit')
      .first()
    if (!profile) {
      return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    }
    const rawBody = request.body()
    const parsedBody = this.getParsedBody(request)
    const hasAnyField = Object.keys(parsedBody).length > 0

    if (!hasAnyField && (typeof rawBody === 'string' || typeof rawBody === 'number')) {
      return response.status(422).send({
        success: false,
        message:
          'Payload không hợp lệ. API PUT /profile/me yêu cầu JSON object (ví dụ { fullName, languages: [...] }), không nhận giá trị đơn lẻ như "1120".',
      })
    }

    const payload = await updateProfileValidator.validate(parsedBody)
    const normalizedLanguages = this.normalizeLanguagesInput(parsedBody)
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
    const orgIdInput = payload.organizationId ?? payload.organization_id
    if (payload.organization !== undefined || orgIdInput !== undefined) {
      try {
        const orgFields = resolveOrganizationFields({
          organization: payload.organization ?? profile.organization,
          organizationId: orgIdInput ?? profile.organizationId,
        })
        updates.organization = orgFields.organization
        updates.organizationId = orgFields.organizationId
      } catch (e) {
        if ((e as Error).message === 'INVALID_ORGANIZATION_ID') {
          return response.unprocessableEntity({
            success: false,
            message: 'organizationId không hợp lệ.',
          })
        }
        throw e
      }
    }

    const deptIdInput = payload.departmentId ?? payload.department_id
    if (payload.faculty !== undefined || deptIdInput !== undefined) {
      try {
        const deptFields = await resolveDepartmentFields({
          faculty:
            payload.faculty !== undefined ? payload.faculty : profile.faculty,
          departmentId:
            deptIdInput !== undefined ? deptIdInput : profile.departmentId,
        })
        updates.faculty = deptFields.faculty
        updates.departmentId = deptFields.departmentId
      } catch (e) {
        if ((e as Error).message === 'INVALID_DEPARTMENT_ID') {
          return response.unprocessableEntity({
            success: false,
            message: 'departmentId không hợp lệ hoặc không ACTIVE.',
          })
        }
        throw e
      }
    }

    if (payload.department !== undefined) updates.department = payload.department ?? null
    if (payload.currentTitle !== undefined) updates.currentTitle = payload.currentTitle ?? null
    if (payload.managementRole !== undefined) updates.managementRole = payload.managementRole ?? null
    if (payload.startWorkingAt !== undefined)
      updates.startWorkingAt = payload.startWorkingAt ? DateTime.fromISO(payload.startWorkingAt) : null
    if (payload.degree !== undefined) {
      const raw = payload.degree == null ? '' : String(payload.degree).trim()
      if (!raw) {
        updates.degree = null
      } else {
        const key = resolveScientificProfileDegreeKey(raw)
        if (!key) {
          return response.unprocessableEntity({
            success: false,
            message:
              'degree không hợp lệ. Gửi key: HIGH_SCHOOL, BACHELOR, UNDERGRADUATE, MASTER, DOCTORATE.',
          })
        }
        updates.degree = key
      }
    }
    if (payload.academicTitle !== undefined) {
      const raw = payload.academicTitle == null ? '' : String(payload.academicTitle).trim()
      if (!raw) {
        updates.academicTitle = null
        updates.academicTitleYear = null
      } else {
        const titleKey = resolveScientificProfileAcademicTitleKey(raw)
        if (!titleKey) {
          return response.unprocessableEntity({
            success: false,
            message:
              'academicTitle không hợp lệ. Gửi key: NONE, ASSOCIATE_PROFESSOR, PROFESSOR.',
          })
        }
        updates.academicTitle = titleKey
        if (titleKey === 'NONE') {
          updates.academicTitleYear = null
        }
      }
    }

    const academicTitleYearInput = payload.academicTitleYear ?? payload.academic_title_year
    if (academicTitleYearInput !== undefined) {
      updates.academicTitleYear =
        academicTitleYearInput === null ? null : Number(academicTitleYearInput)
    }

    if (payload.degreeYear !== undefined) updates.degreeYear = payload.degreeYear ?? null
    if (payload.degreeInstitution !== undefined) updates.degreeInstitution = payload.degreeInstitution ?? null
    if (payload.degreeCountry !== undefined) updates.degreeCountry = payload.degreeCountry ?? null
    if (payload.mainResearchArea !== undefined) updates.mainResearchArea = payload.mainResearchArea ?? null
    if (payload.subResearchAreas !== undefined) updates.subResearchAreas = payload.subResearchAreas ?? []
    if (payload.keywords !== undefined) updates.keywords = payload.keywords ?? []
    await db.transaction(async (trx) => {
      profile.useTransaction(trx)
      profile.merge(updates)
      await profile.save()

      /**
       * Nếu FE gửi `languages` (kể cả mảng rỗng) thì replace toàn bộ.
       * - `undefined`: không đụng tới dữ liệu languages hiện tại
       * - `[]`: xoá sạch languages
       * - `[... ]`: xoá rồi tạo lại theo payload
       */
      if (normalizedLanguages !== undefined) {
        const incoming = normalizedLanguages.map((l) => ({
          profileId: profile.id,
          language: l.language,
          level: l.level ?? null,
          certificate: l.certificate ?? null,
          certificateUrl: l.certificateUrl ?? null,
        }))

        await ProfileLanguage.query({ client: trx }).where('profile_id', profile.id).delete()
        for (const row of incoming) {
          const lang = new ProfileLanguage()
          lang.useTransaction(trx)
          lang.merge(row)
          await lang.save()
        }
      }
    })

    // Reload để response có languages mới nhất
    await profile.load((loader) => loader.load('languages').load('attachments').load('departmentUnit'))

    const ownedPublications = await this.loadOwnedPublications(profile.id)
    profile.completeness = ScientificProfile.calculateCompleteness({
      ...profile.toJSON(),
      languages: profile.languages,
      publications: ownedPublications,
    })
    await profile.save()
    await this.attachAccessiblePublications(profile)
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
    await profile.load((loader) => loader.load('languages').load('attachments').load('departmentUnit'))
    await this.attachAccessiblePublications(profile)
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
      degrees: listScientificProfileDegreeOptions().map((d) => ({
        code: d.value,
        name: d.label,
      })),
      academicTitles: listScientificProfileAcademicTitleOptions().map((t) => ({
        code: t.value,
        name: t.label,
      })),
      researchAreas: fields.map((c) => ({ code: c.code, name: c.name })),
      units: units.map((c) => ({ code: c.code, name: c.name })),
      languages: languages.map((c) => ({ code: c.code, name: c.name })),
    }
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/profile/me/author-profiles-lookup?q=&limit=
   * Gợi ý hồ sơ khoa học nội bộ để gắn profile_id khi khai báo tác giả công bố (không cần quyền profile.view_all).
   * Response: id, fullName, degree/academicTitle (key catalog), organization, department (nhãn hiển thị).
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
      .preload('departmentUnit')
      .orderBy('full_name', 'asc')
      .limit(limit)
      .select(
        'id',
        'full_name',
        'degree',
        'academic_title',
        'organization',
        'faculty',
        'department',
        'department_id'
      )

    const data = rows.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      degree: p.degree ?? null,
      academicTitle: p.academicTitle ?? null,
      organization: p.organization ?? null,
      department: p.departmentUnit?.name ?? p.faculty ?? p.department ?? null,
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

  /**
   * GET /api/profile/udn-affiliation-units — danh mục cơ quan công tác (key + value).
   */
  async udnAffiliationUnits({ response }: HttpContext) {
    return response.ok({
      success: true,
      data: listUdnAffiliationUnitsForSelect(false),
    })
  }

  /** Dùng chung cho response profile (có thể gọi từ ProfilesController). */
  serializeProfile(p: ScientificProfile) {
    const dept = p.departmentUnit
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
      organizationId: p.organizationId ?? null,
      organization_id: p.organizationId ?? null,
      faculty: p.faculty,
      departmentId: p.departmentId ?? null,
      department_id: p.departmentId ?? null,
      department: p.department,
      departmentUnit: dept
        ? {
            id: dept.id,
            code: dept.code,
            name: dept.name,
            short_name: dept.shortName ?? null,
            type: dept.type,
          }
        : null,
      currentTitle: p.currentTitle,
      managementRole: p.managementRole,
      startWorkingAt: p.startWorkingAt ? p.startWorkingAt.toISODate() : null,
      degree: p.degree,
      degreeLabel: getScientificProfileDegreeLabel(p.degree),
      academicTitle: p.academicTitle,
      academicTitleLabel: getScientificProfileAcademicTitleLabel(p.academicTitle),
      academicTitleYear: p.academicTitleYear ?? null,
      academic_title_year: p.academicTitleYear ?? null,
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
        certificate_url: l.certificateUrl,
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
        const isOwner = PublicationAccessService.isOwner(pub, p.id)
        return {
        id: pub.id,
        isOwner,
        canEdit: isOwner,
        title: pub.title,
        authors: pub.authors,
        researchOutputTypeId: pub.researchOutputTypeId,
        researchOutputType: rot ? { id: rot.id, code: rot.code, name: rot.name } : null,
        publicationType: pub.publicationType,
        journalOrConference: pub.journalOrConference,
        year: pub.year,
        publishedAt: formatPublishedAtForResponse(pub.publishedAt),
        published_at: formatPublishedAtForResponse(pub.publishedAt),
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
        createdAt: pub.createdAt.toISO(),
        updatedAt: pub.updatedAt.toISO(),
        }
      }) ?? [],
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt.toISO(),
    }
  }
}
