import type { HttpContext } from '@adonisjs/core/http'
import Publication from '#models/publication'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import KpiEngineService from '#services/kpi_engine_service'
import PermissionService from '#services/permission_service'

/** Lucid/Postgres bigInteger có thể là bigint — Number.isFinite(bigint) là false, phải ép về number. */
function toFinitePositiveInt(v: unknown): number | null {
  if (v == null || v === '') return null
  const n =
    typeof v === 'bigint'
      ? Number(v)
      : typeof v === 'number'
        ? v
        : Number(String(v).trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.trunc(n)
}

function sameNumericId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false
  return Number(a) === Number(b)
}

function isFemaleGender(gender: string | null | undefined): boolean {
  const raw = (gender || '').trim()
  if (!raw) return false
  const upper = raw.toUpperCase()
  if (upper === 'FEMALE' || upper === 'NỮ' || upper === 'NU') return true
  const folded = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase()
  return folded === 'FEMALE' || folded === 'NU'
}

/** Hệ số điều chỉnh theo từng tác giả (nữ 1.2; kiêm nhiệm ngoài chia 2). */
function heSoTacGiaTheoDieuChinh(row: {
  isMultiAffiliationOutsideUdn: boolean
  isFemale: boolean
}): number {
  let factor = 1
  if (row.isMultiAffiliationOutsideUdn) factor *= 0.5
  if (row.isFemale) factor *= 1.2
  return Math.round(factor * 100) / 100
}

/**
 * Giờ lý thuyết một tác giả theo QĐ 1.3 (trước chia 2 kiêm nhiệm / ×1.2 nữ).
 * B: tổng giờ công trình sau B0×a; n: |chính ∪ liên hệ|; p: tổng tác giả.
 */
function gioMotTacGiaTheoQD(
  B: number,
  n: number,
  p: number,
  tongTacGia: number,
  isMainAuthor: boolean,
  isCorresponding: boolean
): number {
  if (!(B > 0) || n < 1 || p < 1) return 0
  const trongNhomChinh = isMainAuthor || isCorresponding
  const tinhNhuChinh = trongNhomChinh || tongTacGia === 1
  const raw = tinhNhuChinh ? B / (3 * n) + (2 * B) / (3 * p) : (2 * B) / (3 * p)
  return Math.round(raw * 100) / 100
}

/** Chỉ tác giả có đơn vị trong ĐHĐN (UDN_ONLY) hoặc kiêm nhiệm trong/ngoài (MIXED) mới được tính. */
function duocTinhTheoMuc15(affiliationType: string): boolean {
  return affiliationType === 'UDN_ONLY' || affiliationType === 'MIXED'
}

/**
 * API KPI: xem KPI giảng viên, breakdown publication, recalculate theo năm học.
 */
export default class KpisController {
  /**
   * GET /api/kpis/teachers/:profileId
   * Query: academic_year (VD 2024-2025). Nếu không truyền, lấy năm học hiện tại (9-8).
   */
  async teachersShow({ params, request, response }: HttpContext) {
    const profileId = toFinitePositiveInt(params.profileId)
    if (profileId == null) {
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
        totalPoints: result.totalPoints,
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
    const pubId = toFinitePositiveInt(params.id)
    if (pubId == null) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const publication = await Publication.query()
      .where('id', pubId)
      .preload('publicationAuthors', (q) => q.preload('profile'))
      .first()
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy công bố.' })
    }

    const ownerPubProfileId = toFinitePositiveInt(publication.profileId)
    if (ownerPubProfileId == null) {
      return response.badRequest({
        success: false,
        message: 'Công bố thiếu profile chủ (publications.profile_id).',
      })
    }

    const profileIdParam = request.input('profile_id', '') as string
    const fromQuery =
      profileIdParam != null && String(profileIdParam).trim() !== ''
        ? toFinitePositiveInt(profileIdParam)
        : null
    const profileId = fromQuery ?? toFinitePositiveInt(publication.profileId)
    if (profileId == null) {
      return response.badRequest({ success: false, message: 'profile_id không hợp lệ.' })
    }

    const profile = await ScientificProfile.find(profileId)
    let isFemale = isFemaleGender(profile?.gender)
    if (!isFemale) {
      const rowOfViewer = publication.publicationAuthors.find(
        (a) => a.profileId != null && sameNumericId(a.profileId, profileId)
      )
      if (rowOfViewer?.profile) {
        isFemale = isFemaleGender(rowOfViewer.profile.gender)
      }
    }

    const output = {
      type: 'PUBLICATION' as const,
      publication: {
        id: toFinitePositiveInt(publication.id)!,
        ownerProfileId: ownerPubProfileId,
        researchOutputTypeId: publication.researchOutputTypeId,
        hdgsnnScore: publication.hdgsnnScore != null ? Number(publication.hdgsnnScore) : null,
      },
      authors: publication.publicationAuthors.map((a) => ({
        profileId: a.profileId != null ? toFinitePositiveInt(a.profileId) : null,
        fullName: a.fullName,
        isMainAuthor: a.isMainAuthor,
        isCorresponding: a.isCorresponding,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
      })),
    }
    const result = await KpiEngineService.calculateOutputHours(output, {
      profileId,
      academicYear: '',
      isFemale,
      profileFullName: profile?.fullName ?? null,
    })

    const details = (result.details || {}) as Record<string, unknown>
    const B0 = typeof details.B0 === 'number' ? details.B0 : 0
    const P0 = typeof details.P0 === 'number' ? details.P0 : 0
    const n = typeof details.n === 'number' ? details.n : 0
    const p = typeof details.p === 'number' ? details.p : 0
    const aExcel = typeof details.aExcel === 'number' ? details.aExcel : 1
    const aReason = String(details.aReason ?? '')
    const aFactor = typeof details.aFactor === 'number' ? details.aFactor : 1
    const matchedFullName = String(details.matchedFullName ?? '')
    const B = typeof details.B === 'number' ? details.B : 0
    const Ppool = typeof details.P === 'number' ? details.P : 0
    const tongTacGia = publication.publicationAuthors.length

    const authorBreakdown = [...publication.publicationAuthors]
      .sort((a, b) => a.authorOrder - b.authorOrder)
      .map((a) => {
        const isViewerRow =
          (a.profileId != null && sameNumericId(a.profileId, profileId)) ||
          (matchedFullName.length > 0 &&
            a.fullName.trim().toLowerCase() === matchedFullName.trim().toLowerCase())
        const rowIsFemale = isFemaleGender(a.profile?.gender)
        let h = 0
        let pts = 0
        if (duocTinhTheoMuc15(a.affiliationType)) {
          h = gioMotTacGiaTheoQD(B, n, p, tongTacGia, a.isMainAuthor, a.isCorresponding)
          if (a.isMultiAffiliationOutsideUdn) {
            h = Math.round((h / 2) * 100) / 100
          }
          if (rowIsFemale) {
            h = Math.round(h * 1.2 * 100) / 100
          }
          // Điểm từng tác giả được suy trực tiếp từ giờ từng tác giả: 1 điểm = 600 giờ.
          pts = Math.round((h / 600) * 100) / 100
        }
        return {
          authorName: a.fullName,
          authorOrder: a.authorOrder,
          isMainAuthor: a.isMainAuthor,
          isCorresponding: a.isCorresponding,
          convertedHours: h,
          convertedPoints: pts,
          isViewerRow,
          coefficient: heSoTacGiaTheoDieuChinh({
            isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
            isFemale: rowIsFemale,
          }),
        }
      })

    return response.ok({
      success: true,
      data: {
        publicationId: toFinitePositiveInt(publication.id)!,
        profileId,
        /** Giờ chuẩn B0 (từ rule; với MULTIPLY_A có thể đã = cột bảng × a) */
        baseHours: B0,
        /** Điểm danh mục P0 (trước chia tác giả) */
        basePoints: P0,
        /** Hệ số a theo QĐ trên cả tập tác giả (VD cùng ĐHĐN = 2) — hiển thị “Hệ số a” trên modal */
        unitCoefficient: aExcel,
        unitCoefficientReason: aReason || null,
        affiliationCompositeA: aExcel,
        authorUnitFactor: aFactor,
        n,
        p,
        nMainAuthors: n,
        pTotalAuthors: p,
        /** Tổng giờ công trình sau B0×a, trước chia n/p (ký hiệu B trong QĐ 1.3) */
        poolHoursB: B,
        /** Tổng điểm công trình theo loại kết quả (P) */
        poolPointsP: Ppool,
        /** Giờ phần NCV đang xem (đã kiêm nhiệm / nữ nếu có) — khớp KPI cá nhân */
        totalConvertedHours: result.hours,
        totalConvertedPoints: result.points ?? 0,
        authorBreakdown,
        totalHours: B > 0 ? B : null,
        totalPoints: Ppool > 0 ? Ppool : null,
        perAuthorConvertedHours: result.hours,
        perAuthorConvertedPoints: result.points ?? 0,
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
