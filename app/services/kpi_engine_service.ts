import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import ProjectProposal from '#models/project_proposal'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'
import { getStrategyForOutput } from '#services/kpi_engine'
import PublicationAccessService from '#services/publication_access_service'
import {
  type KpiPeriodRange,
  khoangNamHoc,
  khoangNamTaiChinh,
  projectTrongKhoangKy,
  publicationTrongKhoangKy,
} from '#utils/kpi_period_helper'
import type { CalculationResult, KpiContext, KpiEngineCache, KpiOutput } from '#types/kpi'

const DEFAULT_QUOTA = 600

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
 * KPI Engine: tính giờ NCKH theo QĐ 1883, rule-driven (lookup theo type_id).
 * Strategy gọi ResearchOutputMapperService + ResearchOutputRule.firstOrFail().
 */
export default class KpiEngineService {
  /**
   * Preload toàn bộ type + rule một lần để dùng chung khi tính KPI hàng loạt,
   * tránh strategy query DB lặp lại cho từng công trình của từng hồ sơ.
   */
  static async buildRuleEngineCache(): Promise<KpiEngineCache> {
    const types = await ResearchOutputType.query().select('id', 'code', 'phamViHeSoA1883')
    const rules = await ResearchOutputRule.all()
    const typeById = new Map<number, { code: string | null; phamViHeSoA1883: string | null }>()
    for (const t of types) {
      typeById.set(Number(t.id), { code: t.code ?? null, phamViHeSoA1883: t.phamViHeSoA1883 ?? null })
    }
    const ruleByTypeId = new Map<number, unknown>()
    for (const r of rules) {
      if (r.typeId != null) ruleByTypeId.set(Number(r.typeId), r)
    }
    return { typeById, ruleByTypeId }
  }

  /**
   * Tính giờ cho một output (publication, project, ...).
   */
  static async calculateOutputHours(
    output: KpiOutput,
    context: KpiContext
  ): Promise<CalculationResult> {
    const strategy = getStrategyForOutput(output)
    if (!strategy) {
      return { hours: 0, warnings: [`Không có strategy cho output type: ${output.type}`] }
    }
    return strategy.calculate(output, context) as Promise<CalculationResult>
  }

  /**
   * Tính KPI giảng viên trong khoảng thời gian (theo publishedAt KQNC; đề tài theo year).
   * Mặc định: năm tài chính hiện tại (từ tháng 4).
   */
  static async calculateTeacherKpi(
    profileId: number,
    period: KpiPeriodRange,
    cache?: KpiEngineCache
  ): Promise<{
    profileId: number
    periodFrom: string
    periodTo: string
    totalHours: number
    /** Tổng điểm quy đổi (KQNC / HĐGSNN) */
    totalPoints: number
    metQuota: boolean
    quota: number
    breakdown: Array<{ type: string; id: number; hours: number; points: number; warnings: string[] }>
    allWarnings: string[]
  }> {
    const profile = await ScientificProfile.find(profileId)
    if (!profile) {
      return {
        profileId,
        periodFrom: period.fromDate,
        periodTo: period.toDate,
        totalHours: 0,
        totalPoints: 0,
        metQuota: false,
        quota: DEFAULT_QUOTA,
        breakdown: [],
        allWarnings: ['Không tìm thấy hồ sơ'],
      }
    }

    const isFemale = isFemaleGender(profile.gender)
    const context: KpiContext = {
      profileId,
      academicYear: `${period.fromDate}_${period.toDate}`,
      isFemale,
      profileFullName: profile.fullName ?? null,
      ruleCache: cache,
    }

    const outputs: KpiOutput[] = []

    const publications = await PublicationAccessService.accessiblePublicationsQuery(profileId)
      .preload('publicationAuthors')
      .orderBy('id', 'asc')

    for (const pub of publications) {
      if (!publicationTrongKhoangKy(pub, period)) continue
      const authors = pub.publicationAuthors.map((a) => ({
        profileId: a.profileId,
        fullName: a.fullName,
        isTopAuthor: a.isTopAuthor,
        isCorresponding: a.isCorresponding,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
        contributionPercent: a.contributionPercent != null ? Number(a.contributionPercent) : null,
      }))
      outputs.push({
        type: 'PUBLICATION',
        publication: {
          id: pub.id,
          ownerProfileId: pub.profileId,
          researchOutputTypeId: pub.researchOutputTypeId,
          hdgsnnScore: pub.hdgsnnScore != null ? Number(pub.hdgsnnScore) : null,
          acceptanceGrade: pub.acceptanceGrade ?? null,
        },
        authors,
      })
    }

    const projects = await ProjectProposal.query()
      .where('owner_id', profile.userId)
      .where('status', 'APPROVED')
      .orderBy('id', 'asc')

    for (const proj of projects) {
      if (!projectTrongKhoangKy(proj, period)) continue
      outputs.push({
        type: 'PROJECT',
        project: {
          id: proj.id,
          researchOutputTypeId: proj.researchOutputTypeId,
          level: proj.level,
          acceptanceGrade: proj.acceptanceGrade,
          cFactor: proj.cFactor,
        },
      })
    }

    const breakdown: Array<{
      type: string
      id: number
      hours: number
      points: number
      warnings: string[]
    }> = []
    const allWarnings: string[] = []
    let totalHours = 0
    let totalPoints = 0

    for (const output of outputs) {
      const result = await this.calculateOutputHours(output, context)
      totalHours += result.hours
      const pts = result.points ?? 0
      totalPoints += pts
      allWarnings.push(...result.warnings)
      const id = output.type === 'PUBLICATION' ? output.publication.id : output.type === 'PROJECT' ? output.project.id : 0
      breakdown.push({
        type: output.type,
        id,
        hours: result.hours,
        points: Math.round(pts * 100) / 100,
        warnings: result.warnings,
      })
    }

    totalHours = Math.round(totalHours * 100) / 100
    totalPoints = Math.round(totalPoints * 100) / 100
    const metQuota = totalHours >= DEFAULT_QUOTA

    return {
      profileId,
      periodFrom: period.fromDate,
      periodTo: period.toDate,
      totalHours,
      totalPoints,
      metQuota,
      quota: DEFAULT_QUOTA,
      breakdown,
      allWarnings,
    }
  }

  /**
   * Tập hợp tất cả profileId có thể phát sinh KPI (có KQNC / là đồng tác giả / chủ nhiệm đề tài đã duyệt).
   */
  static async collectKpiProfileIds(): Promise<Set<number>> {
    const profileIdsFromPubs = await Publication.query().distinct('profile_id').select('profile_id')
    const profileIdsFromCoAuthors = await PublicationAuthor.query()
      .whereNotNull('profile_id')
      .distinct('profile_id')
      .select('profile_id')
    const profileIdsFromProposals = await ProjectProposal.query()
      .where('status', 'APPROVED')
      .distinct('owner_id')
      .select('owner_id')

    const userIds = new Set(profileIdsFromProposals.map((r) => r.ownerId))
    const profilesByUser = await ScientificProfile.query().whereIn('user_id', Array.from(userIds))
    // profile_id là bigint → pg trả về chuỗi; phải ép Number để Set khớp khi đối chiếu sau này.
    const allProfileIds = new Set<number>()
    for (const r of profileIdsFromPubs) {
      if (r.profileId != null) allProfileIds.add(Number(r.profileId))
    }
    for (const r of profileIdsFromCoAuthors) {
      if (r.profileId != null) allProfileIds.add(Number(r.profileId))
    }
    for (const p of profilesByUser) {
      if (p.id != null) allProfileIds.add(Number(p.id))
    }
    return allProfileIds
  }

  /**
   * Tính trực tiếp giờ NCKH theo năm học (lọc KQNC theo ngày xuất bản), không phụ thuộc cache kpi_results.
   * Trả về Map<profileId, totalHours>. Chỉ tính cho các profile trong `onlyProfileIds` nếu được truyền.
   *
   * Tối ưu: load gộp toàn bộ dữ liệu 1 lần (profiles, publications + authors, projects, rule cache)
   * rồi tính trong bộ nhớ — tránh N+1 query theo từng hồ sơ (nguyên nhân báo cáo "quay mãi").
   */
  static async hoursByProfileForAcademicYear(
    academicYear: string,
    onlyProfileIds?: number[]
  ): Promise<Map<number, number>> {
    const period = khoangNamHoc(academicYear) ?? khoangNamTaiChinh()
    const targetIds = onlyProfileIds?.length
      ? new Set(onlyProfileIds.map((n) => Number(n)))
      : await this.collectKpiProfileIds()

    const result = new Map<number, number>()
    if (targetIds.size === 0) return result
    for (const id of targetIds) result.set(id, 0)

    const cache = await this.buildRuleEngineCache()

    // Hồ sơ cần tính: giới tính (hệ số nữ) + họ tên (khớp tác giả) + userId (khớp đề tài)
    const profiles = await ScientificProfile.query()
      .whereIn('id', Array.from(targetIds))
      .select('id', 'fullName', 'gender', 'userId')
    const profileById = new Map<number, ScientificProfile>()
    const profileIdByUserId = new Map<number, number>()
    for (const p of profiles) {
      profileById.set(Number(p.id), p)
      if (p.userId != null) profileIdByUserId.set(Number(p.userId), Number(p.id))
    }

    // Tất cả KQNC + tác giả (1 lần), lọc theo kỳ và gom theo profile có liên quan (chủ bài hoặc đồng tác giả)
    const publications = await Publication.query().preload('publicationAuthors').orderBy('id', 'asc')
    const outputsByProfile = new Map<number, KpiOutput[]>()
    const addOutput = (pid: number, out: KpiOutput) => {
      if (!targetIds.has(pid)) return
      if (!outputsByProfile.has(pid)) outputsByProfile.set(pid, [])
      outputsByProfile.get(pid)!.push(out)
    }

    for (const pub of publications) {
      if (!publicationTrongKhoangKy(pub, period)) continue
      const authors = pub.publicationAuthors.map((a) => ({
        profileId: a.profileId,
        fullName: a.fullName,
        isTopAuthor: a.isTopAuthor,
        isCorresponding: a.isCorresponding,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
        contributionPercent: a.contributionPercent != null ? Number(a.contributionPercent) : null,
      }))
      const output: KpiOutput = {
        type: 'PUBLICATION',
        publication: {
          id: pub.id,
          ownerProfileId: pub.profileId,
          researchOutputTypeId: pub.researchOutputTypeId,
          hdgsnnScore: pub.hdgsnnScore != null ? Number(pub.hdgsnnScore) : null,
          acceptanceGrade: pub.acceptanceGrade ?? null,
        },
        authors,
      }
      // Profile liên quan = chủ bài ∪ các tác giả có profile_id (đúng theo accessiblePublicationsQuery)
      const relatedPids = new Set<number>()
      if (pub.profileId != null) relatedPids.add(Number(pub.profileId))
      for (const a of authors) {
        if (a.profileId != null) relatedPids.add(Number(a.profileId))
      }
      for (const pid of relatedPids) addOutput(pid, output)
    }

    // Tất cả đề tài đã duyệt (1 lần), lọc theo kỳ, gắn theo chủ nhiệm (owner_id = user_id)
    const projects = await ProjectProposal.query().where('status', 'APPROVED').orderBy('id', 'asc')
    for (const proj of projects) {
      if (!projectTrongKhoangKy(proj, period)) continue
      const pid = proj.ownerId != null ? profileIdByUserId.get(Number(proj.ownerId)) : undefined
      if (pid == null) continue
      addOutput(pid, {
        type: 'PROJECT',
        project: {
          id: proj.id,
          researchOutputTypeId: proj.researchOutputTypeId,
          level: proj.level,
          acceptanceGrade: proj.acceptanceGrade,
          cFactor: proj.cFactor,
        },
      })
    }

    // Tính trong bộ nhớ: strategy dùng rule cache nên không còn query DB
    for (const [pid, outputs] of outputsByProfile) {
      const profile = profileById.get(pid)
      if (!profile) continue
      const context: KpiContext = {
        profileId: pid,
        academicYear: `${period.fromDate}_${period.toDate}`,
        isFemale: isFemaleGender(profile.gender),
        profileFullName: profile.fullName ?? null,
        ruleCache: cache,
      }
      let total = 0
      for (const output of outputs) {
        const r = await this.calculateOutputHours(output, context)
        total += r.hours
      }
      result.set(pid, Math.round(total * 100) / 100)
    }
    return result
  }

  /**
   * Tính lại KPI và upsert `kpi_results` (khóa academic_year giữ tương thích — giá trị = năm TC mặc định).
   */
  static async recalcAcademicYear(academicYear: string): Promise<{ updated: number }> {
    const allProfileIds = await this.collectKpiProfileIds()

    // Lọc theo ngày xuất bản trong khoảng năm học đã chọn; nếu chuỗi không hợp lệ thì lùi về năm tài chính hiện tại.
    const period = khoangNamHoc(academicYear) ?? khoangNamTaiChinh()
    const cache = await this.buildRuleEngineCache()
    let updated = 0
    for (const profileId of allProfileIds) {
      const result = await this.calculateTeacherKpi(profileId, period, cache)
      await KpiResult.updateOrCreate(
        { profileId, academicYear },
        {
          profileId,
          academicYear,
          totalHours: result.totalHours,
          metQuota: result.metQuota,
          detail: {
            quota: result.quota,
            totalPoints: result.totalPoints,
            breakdown: result.breakdown,
            allWarnings: result.allWarnings,
          },
        }
      )
      updated += 1
    }
    return { updated }
  }
}
