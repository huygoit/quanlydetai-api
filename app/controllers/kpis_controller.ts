import type { HttpContext } from '@adonisjs/core/http'
import Publication from '#models/publication'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import KpiEngineService from '#services/kpi_engine_service'
import PermissionService from '#services/permission_service'
import NckhDataReportColumnConfigService from '#services/nckh_data_report_column_config_service'
import NckhDataReportService from '#services/nckh_data_report_service'
import * as XLSX from 'xlsx'
import { resolveKpiPeriodRange, khoangNamHoc, publicationTrongKhoangKy, type KpiPeriodRange } from '#utils/kpi_period_helper'
import { genderForPublicationAuthorRow } from '#utils/publication_author_api'
import { dungChiaTheoPhanTramDongGop } from '#services/kpi_engine/publication_strategy'

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

/**
 * Khoảng lọc báo cáo từ query:
 * - publishedFrom + publishedTo (ưu tiên; alias from_date/to_date)
 * - academic_year (legacy năm học)
 * - all=1 hoặc không có ngày → null (không lọc ngày)
 */
function resolveReportPeriod(request: HttpContext['request']): KpiPeriodRange | null {
  const allFlag = String(request.input('all', '') || '').trim()
  if (allFlag === '1' || allFlag.toLowerCase() === 'true') return null

  const from =
    String(request.input('publishedFrom', '') || request.input('from_date', '') || '').trim()
  const to =
    String(request.input('publishedTo', '') || request.input('to_date', '') || '').trim()
  if (from && to) {
    return resolveKpiPeriodRange(from, to)
  }

  const academicYear = String(request.input('academic_year', '') || '').trim()
  if (academicYear) {
    return khoangNamHoc(academicYear)
  }

  return null
}

function nhanKhoangKy(period: KpiPeriodRange | null): string {
  if (!period) return 'Tất cả'
  const a = period.from.toFormat('dd/MM/yyyy')
  const b = period.to.toFormat('dd/MM/yyyy')
  return `${a} – ${b}`
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
  isTopAuthor: boolean,
  isCorresponding: boolean
): number {
  if (!(B > 0) || n < 1 || p < 1) return 0
  const trongNhomChinh = isTopAuthor || isCorresponding
  const tinhNhuChinh = trongNhomChinh || tongTacGia === 1
  const raw = tinhNhuChinh ? B / (3 * n) + (2 * B) / (3 * p) : (2 * B) / (3 * p)
  return Math.round(raw * 100) / 100
}

/**
 * Tác giả được tính giờ: trong ĐHĐN (UDN_ONLY), kiêm nhiệm trong/ngoài (MIXED)
 * và cả Đơn vị khác (OUTSIDE) — theo yêu cầu nghiệp vụ vẫn quy đổi giờ/điểm cho tác giả ngoài.
 */
function duocTinhTheoMuc15(affiliationType: string): boolean {
  return (
    affiliationType === 'UDN_ONLY' ||
    affiliationType === 'MIXED' ||
    affiliationType === 'OUTSIDE'
  )
}

/** Tách họ tên: phần "tên" là từ cuối cùng, phần còn lại là họ - tên đệm. */
function tachHoTen(fullName: string): { hoTenDem: string; ten: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { hoTenDem: '', ten: '' }
  if (parts.length === 1) return { hoTenDem: '', ten: parts[0] }
  const ten = parts[parts.length - 1]
  const hoTenDem = parts.slice(0, -1).join(' ')
  return { hoTenDem, ten }
}

const COLLATOR_VI = new Intl.Collator('vi', { sensitivity: 'base' })

/** Quyền xem báo cáo thống kê NCKH. */
async function userCoQuyenXemBaoCao(userId: number): Promise<boolean> {
  const reportPerms = [
    'report.view',
    'report.view_department',
    'report.view_all',
    'report.export',
    'dashboard.view_department',
    'dashboard.view_all',
  ]
  for (const code of reportPerms) {
    if (await PermissionService.userHasPermission(userId, code)) return true
  }
  return false
}

/** Quyền cấu hình cột báo cáo (admin / xuất báo cáo). */
async function userCoQuyenCauHinhCot(userId: number): Promise<boolean> {
  if (await PermissionService.userHasPermission(userId, 'user.view')) return true
  if (await PermissionService.userHasPermission(userId, 'report.export')) return true
  return false
}

/**
 * API KPI: xem KPI giảng viên, breakdown publication, recalculate theo năm học.
 */
export default class KpisController {
  /**
   * GET /api/kpis/teachers/:profileId
   * Query: from_date, to_date (YYYY-MM-DD). Mặc định: năm tài chính hiện tại (từ 01/04).
   * academic_year (cũ) vẫn nhận nhưng không dùng để lọc — ưu tiên from_date/to_date.
   */
  async teachersShow({ params, request, response }: HttpContext) {
    const profileId = toFinitePositiveInt(params.profileId)
    if (profileId == null) {
      return response.badRequest({ success: false, message: 'profileId không hợp lệ.' })
    }

    const period = resolveKpiPeriodRange(
      request.input('from_date'),
      request.input('to_date')
    )

    const result = await KpiEngineService.calculateTeacherKpi(profileId, period)
    const cached = await KpiResult.query()
      .where('profile_id', profileId)
      .where('academic_year', period.fromDate)
      .first()

    return response.ok({
      success: true,
      data: {
        profileId: result.profileId,
        periodFrom: result.periodFrom,
        periodTo: result.periodTo,
        fromDate: result.periodFrom,
        toDate: result.periodTo,
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
      .preload('researchOutputType')
      .preload('publicationAuthors', (q) => q.preload('profile').preload('student'))
      .first()
    if (!publication) {
      return response.notFound({ success: false, message: 'Không tìm thấy công bố.' })
    }

    const ownerPubProfileId = toFinitePositiveInt(publication.profileId)

    const profileIdParam = request.input('profile_id', '') as string
    const fromQuery =
      profileIdParam != null && String(profileIdParam).trim() !== ''
        ? toFinitePositiveInt(profileIdParam)
        : null
    const profileId = fromQuery ?? ownerPubProfileId ?? null

    const profile = profileId != null ? await ScientificProfile.find(profileId) : null
    let isFemale = isFemaleGender(profile?.gender)
    if (!isFemale && profileId != null) {
      const rowOfViewer = publication.publicationAuthors.find(
        (a) => a.profileId != null && sameNumericId(a.profileId, profileId)
      )
      if (rowOfViewer?.profile) {
        isFemale = isFemaleGender(rowOfViewer.profile.gender)
      } else if (rowOfViewer) {
        isFemale = isFemaleGender(genderForPublicationAuthorRow(rowOfViewer))
      }
    }

    const output = {
      type: 'PUBLICATION' as const,
      publication: {
        id: toFinitePositiveInt(publication.id)!,
        ownerProfileId: ownerPubProfileId ?? profileId ?? 0,
        researchOutputTypeId: publication.researchOutputTypeId,
        hdgsnnScore: publication.hdgsnnScore != null ? Number(publication.hdgsnnScore) : null,
        acceptanceGrade: publication.acceptanceGrade ?? null,
      },
      authors: publication.publicationAuthors.map((a) => ({
        profileId: a.profileId != null ? toFinitePositiveInt(a.profileId) : null,
        fullName: a.fullName,
        isTopAuthor: a.isTopAuthor,
        isCorresponding: a.isCorresponding,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
        contributionPercent: a.contributionPercent != null ? Number(a.contributionPercent) : null,
      })),
    }
    const result = await KpiEngineService.calculateOutputHours(output, {
      profileId: profileId ?? 0,
      academicYear: '',
      isFemale,
      profileFullName: profile?.fullName ?? null,
    })

    const details = (result.details || {}) as Record<string, unknown>
    const B0 = typeof details.B0 === 'number' ? details.B0 : 0
    const P0 = typeof details.P0 === 'number' ? details.P0 : 0
    const n = typeof details.n === 'number' ? details.n : 0
    const p = typeof details.p === 'number' ? details.p : 0
    const ruleKindRaw = details.ruleKind
    const ruleKind = typeof ruleKindRaw === 'string' && ruleKindRaw.trim() ? ruleKindRaw.trim() : null
    const aExcelRaw = details.aExcel
    const aExcel =
      typeof aExcelRaw === 'number' && Number.isFinite(aExcelRaw) ? (aExcelRaw as number) : null
    const aReason = String(details.aReason ?? '')
    const aFactor = typeof details.aFactor === 'number' ? details.aFactor : 1
    const matchedFullName = String(details.matchedFullName ?? '')
    const B = typeof details.B === 'number' ? details.B : 0
    const Ppool = typeof details.P === 'number' ? details.P : 0
    const tongTacGia = publication.publicationAuthors.length
    // Mục 1.4: sản phẩm KH khác chia giờ theo % đóng góp thay vì công thức n/p.
    const leafCode = publication.researchOutputType?.code ?? null
    const dungPhanTram = dungChiaTheoPhanTramDongGop(leafCode, ruleKind)
    const tongPhanTram = publication.publicationAuthors.reduce(
      (s, a) => s + (a.contributionPercent != null ? Number(a.contributionPercent) : 0),
      0
    )
    const phanTramHopLe = Math.abs(tongPhanTram - 100) < 0.01
    const nTopAuthorsOnly = publication.publicationAuthors.filter((a) => a.isTopAuthor).length
    const nCorrespondingAuthors = publication.publicationAuthors.filter((a) => a.isCorresponding).length
    const nPrimaryOrCorrespondingAuthors = publication.publicationAuthors.filter(
      (a) => a.isTopAuthor || a.isCorresponding
    ).length

    const authorBreakdown = [...publication.publicationAuthors]
      .sort((a, b) => a.authorOrder - b.authorOrder)
      .map((a) => {
        const isViewerRow =
          profileId != null &&
          ((a.profileId != null && sameNumericId(a.profileId, profileId)) ||
            (matchedFullName.length > 0 &&
              a.fullName.trim().toLowerCase() === matchedFullName.trim().toLowerCase()))
        const rowIsFemale = isFemaleGender(genderForPublicationAuthorRow(a))
        let h = 0
        let pts = 0
        if (duocTinhTheoMuc15(a.affiliationType)) {
          if (dungPhanTram) {
            const pct = a.contributionPercent != null ? Number(a.contributionPercent) : null
            const pctRowHopLe = pct != null && pct > 0 && phanTramHopLe
            h = pctRowHopLe
              ? Math.round(B * (pct / 100) * 100) / 100
              : tongTacGia > 0
                ? Math.round((B / tongTacGia) * 100) / 100
                : 0
          } else {
            h = gioMotTacGiaTheoQD(B, n, p, tongTacGia, a.isTopAuthor, a.isCorresponding)
          }
          if (a.isMultiAffiliationOutsideUdn) {
            h = Math.round((h / 2) * 100) / 100
          }
          if (rowIsFemale) {
            h = Math.round(h * 1.2 * 100) / 100
          }
          // Điểm từng tác giả = giờ/600; làm tròn 4 chữ số thập phân để khớp P0 nhỏ (vd 21 giờ → 0,035 điểm), tránh nhầm với làm tròn 2 số.
          pts = Math.round((h / 600) * 10000) / 10000
        }
        return {
          authorName: a.fullName,
          authorOrder: a.authorOrder,
          isTopAuthor: a.isTopAuthor,
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
        /** Hệ số a mục 1.1 — chỉ có nghĩa với MULTIPLY_A; loại khác null để UI hiển thị NA */
        unitCoefficient: aExcel,
        unitCoefficientReason: aReason || null,
        ruleKind,
        affiliationCompositeA: aExcel,
        authorUnitFactor: aFactor,
        n,
        p,
        /**
         * `n` trong công thức là hợp (tác giả chính ∪ tác giả liên hệ).
         * Trả thêm các chỉ số tách riêng để tránh hiểu nhầm.
         */
        nTopAuthors: nTopAuthorsOnly,
        nCorrespondingAuthors,
        nPrimaryOrCorrespondingAuthors,
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

  /**
   * GET /api/kpis/nckh-hours-report
   * Query: publishedFrom + publishedTo (hoặc all=1), faculty.
   * Legacy: academic_year (năm học). Lọc theo ngày xuất bản, gom giờ theo Khoa/đơn vị.
   */
  async nckhHoursReport({ request, response, auth }: HttpContext) {
    const user = auth.use('api').user!
    const reportPerms = [
      'report.view',
      'report.view_department',
      'report.view_all',
      'report.export',
      'dashboard.view_department',
      'dashboard.view_all',
    ]
    let allowed = false
    for (const code of reportPerms) {
      if (await PermissionService.userHasPermission(user.id, code)) {
        allowed = true
        break
      }
    }
    if (!allowed) {
      return response.forbidden({
        success: false,
        message: 'Bạn không có quyền xem báo cáo thống kê.',
      })
    }

    const period = resolveReportPeriod(request)
    const facultyParam = String(request.input('faculty', '')).trim()
    const periodLabel = nhanKhoangKy(period)

    // Danh sách đơn vị có hồ sơ (để FE đổ vào ô chọn)
    const facultyRows = await ScientificProfile.query()
      .whereNotNull('faculty')
      .distinct('faculty')
      .select('faculty')
    const faculties = facultyRows
      .map((r) => (r.faculty || '').trim())
      .filter((f) => f.length > 0)
      .sort((a, b) => COLLATOR_VI.compare(a, b))

    // Tính trực tiếp theo ngày xuất bản trong khoảng đã chọn (không đọc cache kpi_results).
    let hoursMap: Map<number, number>
    if (facultyParam) {
      const fp = await ScientificProfile.query().where('faculty', facultyParam).select('id')
      const onlyIds = fp.map((p) => Number(p.id))
      hoursMap = onlyIds.length
        ? await KpiEngineService.hoursByProfileForPeriod(period, onlyIds)
        : new Map<number, number>()
    } else {
      hoursMap = await KpiEngineService.hoursByProfileForPeriod(period)
    }
    const profileIds = Array.from(hoursMap.keys())
    const profileRows = profileIds.length
      ? await ScientificProfile.query().whereIn('id', profileIds).select('id', 'fullName', 'faculty')
      : []
    const profileById = new Map(profileRows.map((p) => [Number(p.id), p]))

    const UNIT_FALLBACK = 'Chưa phân đơn vị'
    const grouped = new Map<
      string,
      Array<{ fullName: string; hoTenDem: string; ten: string; hours: number }>
    >()

    for (const [pid, hours] of hoursMap) {
      if (!(hours > 0)) continue
      const profile = profileById.get(pid)
      if (!profile) continue
      const unit = (profile.faculty || '').trim() || UNIT_FALLBACK
      const { hoTenDem, ten } = tachHoTen(profile.fullName || '')
      if (!grouped.has(unit)) grouped.set(unit, [])
      grouped.get(unit)!.push({ fullName: profile.fullName || '', hoTenDem, ten, hours })
    }

    const units = Array.from(grouped.entries())
      .map(([unit, members]) => {
        const sorted = members.sort((a, b) => {
          const byTen = COLLATOR_VI.compare(a.ten, b.ten)
          if (byTen !== 0) return byTen
          return COLLATOR_VI.compare(a.hoTenDem, b.hoTenDem)
        })
        const subtotal = sorted.reduce((s, m) => s + m.hours, 0)
        return {
          unit,
          subtotal: Math.round(subtotal * 100) / 100,
          rows: sorted.map((m, i) => ({
            stt: i + 1,
            fullName: m.fullName,
            hoTenDem: m.hoTenDem,
            ten: m.ten,
            hours: Math.round(m.hours * 100) / 100,
            note: '',
          })),
        }
      })
      .sort((a, b) => {
        if (a.unit === UNIT_FALLBACK) return 1
        if (b.unit === UNIT_FALLBACK) return -1
        return COLLATOR_VI.compare(a.unit, b.unit)
      })

    const grandTotal = units.reduce((s, u) => s + u.subtotal, 0)
    const totalPeople = units.reduce((s, u) => s + u.rows.length, 0)

    return response.ok({
      success: true,
      data: {
        academic_year: periodLabel,
        period_from: period?.fromDate ?? null,
        period_to: period?.toDate ?? null,
        period_label: periodLabel,
        faculty: facultyParam,
        faculties,
        generated_at: new Date().toISOString(),
        total_people: totalPeople,
        grand_total: Math.round(grandTotal * 100) / 100,
        units,
      },
    })
  }

  /**
   * GET /api/kpis/nckh-data-report/column-config
   * Trả cấu hình cột đã chọn + cây danh mục để FE cấu hình.
   */
  async nckhDataReportColumnConfig({ response, auth }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await userCoQuyenXemBaoCao(user.id))) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền xem báo cáo thống kê.' })
    }

    const { selection, isDefaultAll, allTypes } = await NckhDataReportColumnConfigService.getSelection()
    const catalogTree = NckhDataReportColumnConfigService.buildDisplayColumns(
      allTypes,
      {
        level1Ids: allTypes.filter((t) => t.isActive && t.level === 1).map((t) => t.id),
        level2Ids: allTypes.filter((t) => t.isActive && t.level === 2).map((t) => t.id),
        level3Ids: allTypes.filter((t) => t.isActive && t.level === 3).map((t) => t.id),
      }
    ).columnTree

    return response.ok({
      success: true,
      data: {
        selection,
        isDefaultAll,
        canConfigure: await userCoQuyenCauHinhCot(user.id),
        catalogTree,
      },
    })
  }

  /**
   * PUT /api/kpis/nckh-data-report/column-config
   * Body: { level1Ids, level2Ids, level3Ids }
   */
  async updateNckhDataReportColumnConfig({ request, response, auth }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await userCoQuyenCauHinhCot(user.id))) {
      return response.forbidden({
        success: false,
        message: 'Bạn không có quyền cấu hình cột báo cáo.',
      })
    }

    const body = request.body() || {}
    const selection = await NckhDataReportColumnConfigService.saveSelection({
      level1Ids: Array.isArray(body.level1Ids) ? body.level1Ids : [],
      level2Ids: Array.isArray(body.level2Ids) ? body.level2Ids : [],
      level3Ids: Array.isArray(body.level3Ids) ? body.level3Ids : [],
    })

    return response.ok({
      success: true,
      message: 'Đã lưu cấu hình cột báo cáo.',
      data: { selection },
    })
  }

  /**
   * GET /api/kpis/nckh-data-report
   * Query: publishedFrom + publishedTo (hoặc all=1), faculty.
   * Ma trận theo cột loại KQNC đã cấu hình (L1 → L2 → L3).
   */
  async nckhDataReport({ request, response, auth }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await userCoQuyenXemBaoCao(user.id))) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền xem báo cáo thống kê.' })
    }

    const period = resolveReportPeriod(request)
    const periodLabel = nhanKhoangKy(period)
    const facultyParam = String(request.input('faculty', '')).trim()
    const data = await NckhDataReportService.build({ period, periodLabel, facultyParam })
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/kpis/nckh-data-report/export-excel
   * Xuất Excel đủ cột theo cấu hình L1/L2/L3 (cùng filter kỳ + khoa).
   */
  async exportNckhDataReportExcel({ request, response, auth }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await userCoQuyenXemBaoCao(user.id))) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền xem báo cáo thống kê.' })
    }

    const period = resolveReportPeriod(request)
    const periodLabel = nhanKhoangKy(period)
    const facultyParam = String(request.input('faculty', '')).trim()
    const data = await NckhDataReportService.build({ period, periodLabel, facultyParam })

    if (!data.faculty) {
      return response.badRequest({ success: false, message: 'Chưa có Khoa/đơn vị để xuất.' })
    }
    if (!data.leafColumns.length) {
      return response.badRequest({
        success: false,
        message: 'Chưa chọn cột loại kết quả. Vào Cấu hình cột trước khi xuất Excel.',
      })
    }

    const leafN = data.leafColumns.length
    const title = `DỮ LIỆU NCKH CỦA ${data.faculty.toUpperCase()}`
    const periodLine = data.period_label || ''

    // Hàng tiêu đề + 3 hàng header (L1 / L2 / L3) + dữ liệu + tổng
    const rowTitle: (string | number)[] = [title]
    const rowPeriod: (string | number)[] = [periodLine]
    const rowL1: (string | number)[] = ['Số TT', 'Họ và tên đệm', 'Tên']
    const rowL2: (string | number)[] = ['', '', '']
    const rowL3: (string | number)[] = ['', '', '']

    for (const l1 of data.columnTree) {
      const n1 = demSoLaCot(l1)
      rowL1.push(l1.name)
      for (let i = 1; i < n1; i++) rowL1.push('')
      for (const l2 of l1.children || []) {
        const n2 = demSoLaCot(l2)
        rowL2.push(l2.name)
        for (let i = 1; i < n2; i++) rowL2.push('')
        for (const l3 of l2.children || []) {
          rowL3.push(l3.name)
        }
      }
    }
    rowL1.push('Giờ Nghiên cứu khoa học', 'Ghi chú')
    rowL2.push('', '')
    rowL3.push('', '')

    const sheetData: (string | number)[][] = [rowTitle, rowPeriod, rowL1, rowL2, rowL3]

    for (const r of data.rows) {
      const line: (string | number)[] = [r.stt, r.hoTenDem, r.ten]
      for (const leaf of data.leafColumns) {
        line.push(r.counts?.[String(leaf.id)] || 0)
      }
      line.push(r.hours || 0, r.note || '')
      sheetData.push(line)
    }

    const totalLine: (string | number)[] = ['', 'Tổng cộng', '']
    for (const leaf of data.leafColumns) {
      totalLine.push(data.totals.counts?.[String(leaf.id)] || 0)
    }
    totalLine.push(data.totals.hours || 0, '')
    sheetData.push(totalLine)

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(sheetData)

    // Merge tiêu đề / kỳ / header định danh + colspan L1/L2
    const lastCol = 2 + leafN + 2 // 0-based: STT..Ghi chú
    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
      { s: { r: 2, c: 0 }, e: { r: 4, c: 0 } }, // STT
      { s: { r: 2, c: 1 }, e: { r: 4, c: 1 } }, // Họ
      { s: { r: 2, c: 2 }, e: { r: 4, c: 2 } }, // Tên
      { s: { r: 2, c: 3 + leafN }, e: { r: 4, c: 3 + leafN } }, // Giờ
      { s: { r: 2, c: 4 + leafN }, e: { r: 4, c: 4 + leafN } }, // Ghi chú
    ]

    let col = 3
    for (const l1 of data.columnTree) {
      const n1 = demSoLaCot(l1)
      if (n1 > 1) merges.push({ s: { r: 2, c: col }, e: { r: 2, c: col + n1 - 1 } })
      let c2 = col
      for (const l2 of l1.children || []) {
        const n2 = demSoLaCot(l2)
        if (n2 > 1) merges.push({ s: { r: 3, c: c2 }, e: { r: 3, c: c2 + n2 - 1 } })
        c2 += n2
      }
      col += n1
    }
    ws['!merges'] = merges
    ws['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 12 },
      ...data.leafColumns.map(() => ({ wch: 14 })),
      { wch: 12 },
      { wch: 16 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Du lieu NCKH')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const safeFaculty = data.faculty.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().slice(0, 40) || 'don-vi'
    const filename = `thong-ke-ket-qua-nckh-${safeFaculty}.xlsx`

    response.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return response.send(buf)
  }
}

/** Đếm số lá L3 trong nhánh cột (dùng khi xuất Excel). */
function demSoLaCot(node: { level: number; children?: Array<{ level: number; children?: any[] }> }): number {
  if (node.level === 3) return 1
  return (node.children || []).reduce((s, c) => s + demSoLaCot(c), 0)
}
