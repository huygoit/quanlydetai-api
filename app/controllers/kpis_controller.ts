import type { HttpContext } from '@adonisjs/core/http'
import Publication from '#models/publication'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import KpiEngineService from '#services/kpi_engine_service'
import PermissionService from '#services/permission_service'

/**
 * API KPI: xem KPI giảng viên, breakdown publication, recalculate theo năm học.
 */
export default class KpisController {
  /**
   * GET /api/kpis/teachers/:profileId
   * Query: academic_year (VD 2024-2025). Nếu không truyền, lấy năm học hiện tại (9-8).
   */
  async teachersShow({ params, request, response }: HttpContext) {
    const profileId = Number(params.profileId)
    if (!Number.isFinite(profileId)) {
      return response.badRequest({ success: false, message: 'profileId không hợp lệ.' })
    }

    let academicYear = request.input('academic_year', '') as string
    if (!academicYear.trim()) {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth() + 1
      if (m >= 9) academicYear = `${y}-${y + 1}`
      else academicYear = `${y - 1}-${y}`
    }

    const result = await KpiEngineService.calculateTeacherKpi(profileId, academicYear)
    const cached = await KpiResult.query()
      .where('profile_id', profileId)
      .where('academic_year', academicYear)
      .first()

    return response.ok({
      success: true,
      data: {
        profileId: result.profileId,
        academicYear: result.academicYear,
        totalHours: result.totalHours,
        metQuota: result.metQuota,
        quota: result.quota,
        breakdown: result.breakdown,
        allWarnings: result.allWarnings,
        cachedAt: cached?.updatedAt?.toISO() ?? null,
      },
    })
  }

  /**
   * GET /api/kpis/publications/:id/breakdown
   * Query: profile_id (optional) — profile cần tính giờ. Mặc định = publication.profileId.
   */
  async publicationsBreakdown({ params, request, response }: HttpContext) {
    const pubId = Number(params.id)
    if (!Number.isFinite(pubId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const publication = await Publication.query()
      .where('id', pubId)
      .preload('publicationAuthors', (q) => q.preload('profile'))
      .first()
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy công bố.' })
    }

    const profileIdParam = request.input('profile_id', '') as string
    const profileId = profileIdParam ? Number(profileIdParam) : publication.profileId
    if (!Number.isFinite(profileId)) {
      return response.badRequest({ success: false, message: 'profile_id không hợp lệ.' })
    }

    const profile = await ScientificProfile.find(profileId)
    const isFemale = profile?.gender?.toUpperCase() === 'NỮ'

    const output = {
      type: 'PUBLICATION' as const,
      publication: {
        id: publication.id,
        rank: publication.rank,
        quartile: publication.quartile,
        domesticRuleType: publication.domesticRuleType,
      },
      authors: publication.publicationAuthors.map((a) => ({
        profileId: a.profileId,
        isMainAuthor: a.isMainAuthor,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
      })),
    }
    const result = await KpiEngineService.calculateOutputHours(
      output,
      { profileId, academicYear: '', isFemale }
    )

    const details = (result.details || {}) as Record<string, unknown>
    return response.ok({
      success: true,
      data: {
        publicationId: publication.id,
        profileId,
        baseHours: details.B0 ?? null,
        aFactor: details.aFactor ?? null,
        totalHours: details.B ?? null,
        nMainAuthors: details.n ?? null,
        pTotalAuthors: details.p ?? null,
        perAuthorConvertedHours: result.hours,
        warnings: result.warnings,
      },
    })
  }

  /**
   * POST /api/kpis/recalculate
   * Body: { academic_year: "2024-2025" }. Tính lại toàn bộ profile trong năm học và upsert kpi_results.
   */
  async recalculate({ request, response, auth }: HttpContext) {
    const user = auth.use('api').user!
    const hasPerm = await PermissionService.userHasPermission(user.id, 'profile.verify') ||
      await PermissionService.userHasPermission(user.id, 'profile.view_all')
    if (!hasPerm) {
      return response.forbidden({
        success: false,
        message: 'Chỉ người có quyền quản lý hồ sơ được gọi recalculate.',
      })
    }

    const body = request.body()
    const academicYear = (body?.academic_year ?? request.input('academic_year', '')).trim()
    if (!academicYear) {
      return response.badRequest({
        success: false,
        message: 'Thiếu academic_year (VD: 2024-2025).',
      })
    }

    const { updated } = await KpiEngineService.recalcAcademicYear(academicYear)
    return response.ok({
      success: true,
      message: `Đã cập nhật KPI cho ${updated} hồ sơ trong năm học ${academicYear}.`,
      data: { academicYear, updated },
    })
  }
}
