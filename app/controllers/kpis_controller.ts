import type { HttpContext } from '@adonisjs/core/http'
import Publication from '#models/publication'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import ResearchOutputType from '#models/research_output_type'
import ProjectProposal from '#models/project_proposal'
import KpiEngineService from '#services/kpi_engine_service'
import PermissionService from '#services/permission_service'
import { resolveKpiPeriodRange, khoangNamHoc, publicationTrongKhoangKy } from '#utils/kpi_period_helper'
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

/** Các "ô" đếm trong biểu mẫu DỮ LIỆU NCKH theo Khoa. */
type NckhBucket =
  | 'wos_scopus'
  | 'intl_other'
  | 'isbn_proc'
  | 'sv_nckh'
  | 'textbook'
  | 'monograph'
  | 'reference'
  | 'training_doc'
  | 'ip'

/** Một dòng số liệu của 1 giảng viên (chưa có STT/tách tên). */
function emptyNckhRow(fullName: string) {
  return {
    fullName,
    wos_scopus: 0,
    intl_other: 0,
    isbn_proc: 0,
    dt_nha_nuoc: 0,
    dt_bo: 0,
    dt_truong: 0,
    dt_co_so: 0,
    sv_nckh: 0,
    hours: 0,
    textbook: 0,
    monograph: 0,
    reference: 0,
    training_doc: 0,
    ip: 0,
    note: '',
  }
}

function emptyNckhTotals() {
  return {
    wos_scopus: 0,
    intl_other: 0,
    isbn_proc: 0,
    dt_nha_nuoc: 0,
    dt_bo: 0,
    dt_truong: 0,
    dt_co_so: 0,
    sv_nckh: 0,
    hours: 0,
    textbook: 0,
    monograph: 0,
    reference: 0,
    training_doc: 0,
    ip: 0,
  }
}

/** Map cấp đề tài (project_proposals.level) -> cột trong biểu mẫu. */
function projectLevelToKey(
  level: string | null
): 'dt_nha_nuoc' | 'dt_bo' | 'dt_truong' | 'dt_co_so' | null {
  switch ((level || '').trim()) {
    case 'NHA_NUOC':
      return 'dt_nha_nuoc'
    case 'BO':
      return 'dt_bo'
    case 'TRUONG':
      return 'dt_truong'
    case 'CO_SO':
      return 'dt_co_so'
    default:
      return null
  }
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
   * Query: academic_year (VD: 2024-2025). Lấy giờ NCKH từ cache kpi_results, gom theo Khoa/đơn vị,
   * sắp xếp theo tên (từ cuối). Phục vụ biểu mẫu thống kê giờ NCKH (in/PDF).
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

    const academicYear = String(request.input('academic_year', '')).trim()
    if (!academicYear) {
      return response.badRequest({
        success: false,
        message: 'Thiếu academic_year (VD: 2024-2025).',
      })
    }

    // Tính trực tiếp theo ngày xuất bản trong năm học (không đọc cache kpi_results)
    const hoursMap = await KpiEngineService.hoursByProfileForAcademicYear(academicYear)
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
      // Chỉ liệt kê người có giờ NCKH trong năm học đã chọn
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
        // Đẩy nhóm "Chưa phân đơn vị" xuống cuối, còn lại sắp theo tên đơn vị
        if (a.unit === UNIT_FALLBACK) return 1
        if (b.unit === UNIT_FALLBACK) return -1
        return COLLATOR_VI.compare(a.unit, b.unit)
      })

    const grandTotal = units.reduce((s, u) => s + u.subtotal, 0)
    const totalPeople = units.reduce((s, u) => s + u.rows.length, 0)

    return response.ok({
      success: true,
      data: {
        academic_year: academicYear,
        generated_at: new Date().toISOString(),
        total_people: totalPeople,
        grand_total: Math.round(grandTotal * 100) / 100,
        units,
      },
    })
  }

  /**
   * GET /api/kpis/nckh-data-report
   * Query: academic_year (cho cột giờ NCKH), faculty (Khoa cần xem).
   * Trả ma trận "DỮ LIỆU NCKH CỦA KHOA": mỗi giảng viên 1 dòng, đếm số công trình theo loại.
   */
  async nckhDataReport({ request, response, auth }: HttpContext) {
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
      return response.forbidden({ success: false, message: 'Bạn không có quyền xem báo cáo thống kê.' })
    }

    const academicYear = String(request.input('academic_year', '')).trim()
    const facultyParam = String(request.input('faculty', '')).trim()

    // Danh sách các Khoa/đơn vị có hồ sơ (để FE đổ vào ô chọn)
    const facultyRows = await ScientificProfile.query()
      .whereNotNull('faculty')
      .distinct('faculty')
      .select('faculty')
    const faculties = facultyRows
      .map((r) => (r.faculty || '').trim())
      .filter((f) => f.length > 0)
      .sort((a, b) => COLLATOR_VI.compare(a, b))

    const faculty = facultyParam || faculties[0] || ''
    if (!faculty) {
      return response.ok({
        success: true,
        data: { academic_year: academicYear, faculty: '', generated_at: new Date().toISOString(), faculties, rows: [], totals: emptyNckhTotals() },
      })
    }

    // Map loại KQNC -> "ô" thống kê dựa trên cây phân cấp
    const types = await ResearchOutputType.query().select('id', 'parentId')
    const parentMap = new Map<number, number | null>()
    types.forEach((t) => parentMap.set(Number(t.id), t.parentId != null ? Number(t.parentId) : null))
    const ancestorsInclusive = (id: number): Set<number> => {
      const set = new Set<number>()
      let cur: number | null = id
      let guard = 0
      while (cur != null && guard < 10) {
        set.add(cur)
        cur = parentMap.get(cur) ?? null
        guard++
      }
      return set
    }
    const bucketOfType = (typeId: number | null): NckhBucket | null => {
      if (typeId == null) return null
      const anc = ancestorsInclusive(typeId)
      if (typeId === 22) return 'monograph'
      if (typeId === 23) return 'reference'
      if (typeId === 25) return 'training_doc'
      if (typeId === 26 || typeId === 27) return 'textbook'
      if (anc.has(2) || anc.has(8)) return 'wos_scopus'
      if (anc.has(17)) return 'intl_other'
      if (anc.has(19)) return 'isbn_proc'
      if (anc.has(43)) return 'sv_nckh'
      if (anc.has(50)) return 'ip'
      return null
    }

    // Hồ sơ trong Khoa
    const profiles = await ScientificProfile.query()
      .where('faculty', faculty)
      .select('id', 'fullName', 'userId')
    const profileIds = profiles.map((p) => Number(p.id))
    const userIdToProfileId = new Map<number, number>()
    profiles.forEach((p) => {
      if (p.userId != null) userIdToProfileId.set(Number(p.userId), Number(p.id))
    })

    // Khởi tạo dòng cho từng hồ sơ
    const rowByProfile = new Map<number, ReturnType<typeof emptyNckhRow>>()
    profiles.forEach((p) => {
      rowByProfile.set(Number(p.id), emptyNckhRow(p.fullName || ''))
    })

    // Đếm publications theo người kê khai (profile_id), lọc theo ngày xuất bản trong năm học đã chọn
    const namHocRange = khoangNamHoc(academicYear)
    if (profileIds.length > 0) {
      const pubs = await Publication.query()
        .whereIn('profile_id', profileIds)
        .select('profileId', 'researchOutputTypeId', 'publishedAt', 'year')
      for (const pub of pubs) {
        const pid = pub.profileId != null ? Number(pub.profileId) : null
        if (pid == null) continue
        // Có chọn năm học thì chỉ đếm KQNC có ngày xuất bản nằm trong khoảng năm học đó
        if (namHocRange && !publicationTrongKhoangKy(pub, namHocRange)) continue
        const row = rowByProfile.get(pid)
        if (!row) continue
        const bucket = bucketOfType(pub.researchOutputTypeId != null ? Number(pub.researchOutputTypeId) : null)
        if (bucket) row[bucket] += 1
      }

      // Giờ NCKH tính trực tiếp theo ngày xuất bản trong năm học (không đọc cache)
      if (academicYear) {
        const hoursMap = await KpiEngineService.hoursByProfileForAcademicYear(
          academicYear,
          profileIds
        )
        for (const [pid, hours] of hoursMap) {
          const row = rowByProfile.get(Number(pid))
          if (row) row.hours = Math.round((Number(hours) || 0) * 100) / 100
        }
      }

      // Đề tài KHCN theo cấp (project_proposals.owner_id = user_id)
      const userIds = Array.from(userIdToProfileId.keys())
      if (userIds.length > 0) {
        const proposals = await ProjectProposal.query()
          .whereIn('owner_id', userIds)
          .select('ownerId', 'level')
        for (const pr of proposals) {
          const pid = userIdToProfileId.get(Number(pr.ownerId))
          if (pid == null) continue
          const row = rowByProfile.get(pid)
          if (!row) continue
          const key = projectLevelToKey(pr.level)
          if (key) row[key] += 1
        }
      }
    }

    // Sắp xếp theo tên (từ cuối)
    const rows = Array.from(rowByProfile.values())
      .map((r) => {
        const { hoTenDem, ten } = tachHoTen(r.fullName)
        return { ...r, hoTenDem, ten }
      })
      .sort((a, b) => {
        const byTen = COLLATOR_VI.compare(a.ten, b.ten)
        if (byTen !== 0) return byTen
        return COLLATOR_VI.compare(a.hoTenDem, b.hoTenDem)
      })
      .map((r, i) => ({ stt: i + 1, ...r }))

    // Cộng các cột
    const totals = emptyNckhTotals()
    for (const r of rows) {
      totals.wos_scopus += r.wos_scopus
      totals.intl_other += r.intl_other
      totals.isbn_proc += r.isbn_proc
      totals.dt_nha_nuoc += r.dt_nha_nuoc
      totals.dt_bo += r.dt_bo
      totals.dt_truong += r.dt_truong
      totals.dt_co_so += r.dt_co_so
      totals.sv_nckh += r.sv_nckh
      totals.hours += r.hours
      totals.textbook += r.textbook
      totals.monograph += r.monograph
      totals.reference += r.reference
      totals.training_doc += r.training_doc
      totals.ip += r.ip
    }
    totals.hours = Math.round(totals.hours * 100) / 100

    return response.ok({
      success: true,
      data: {
        academic_year: academicYear,
        faculty,
        generated_at: new Date().toISOString(),
        faculties,
        rows,
        totals,
      },
    })
  }
}
