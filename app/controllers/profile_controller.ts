import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ScientificProfile from '#models/scientific_profile'
import ProfileLanguage from '#models/profile_language'
import ProfileAttachment from '#models/profile_attachment'
import Publication from '#models/publication'
import Catalog from '#models/catalog'
import NotificationService from '#services/notification_service'
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
      .preload('publications')
      .first()
    if (!profile) {
      return response.notFound({ success: false, message: 'Chưa có hồ sơ. Gọi POST /api/profile/me để tạo.' })
    }
    return response.ok({ success: true, data: this.serializeProfile(profile) })
  }

  /**
   * Tạo hồ sơ mới (nếu chưa có).
   */
  async storeMe({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    let profile = await ScientificProfile.findBy('user_id', user.id)
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
    await profile.load((loader) => loader.load('languages').load('attachments').load('publications'))
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
      .preload('publications')
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
    await profile.load((loader) => loader.load('languages').load('attachments').load('publications'))
    return response.ok({ success: true, data: this.serializeProfile(profile) })
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
      publications: (p.publications as Publication[] | undefined)?.map((pub) => ({
        id: pub.id,
        title: pub.title,
        authors: pub.authors,
        publicationType: pub.publicationType,
        journalOrConference: pub.journalOrConference,
        year: pub.year,
        publicationStatus: pub.publicationStatus,
        rank: pub.rank,
        quartile: pub.quartile,
        doi: pub.doi,
        createdAt: pub.createdAt.toISO(),
      })) ?? [],
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt.toISO(),
    }
  }
}
