import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import ProjectProposal from '#models/project_proposal'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import { getStrategyForOutput } from '#services/kpi_engine'
import PublicationAccessService from '#services/publication_access_service'
import {
  type KpiPeriodRange,
  khoangNamTaiChinh,
  projectTrongKhoangKy,
  publicationTrongKhoangKy,
} from '#utils/kpi_period_helper'
import type { CalculationResult, KpiContext, KpiOutput } from '#types/kpi'

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
    period: KpiPeriodRange
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
   * Tính lại KPI và upsert `kpi_results` (khóa academic_year giữ tương thích — giá trị = năm TC mặc định).
   */
  static async recalcAcademicYear(academicYear: string): Promise<{ updated: number }> {
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
    const profileIdsFromProposalsResolved = new Set(profilesByUser.map((p) => p.id))
    const allProfileIds = new Set<number>()
    for (const r of profileIdsFromPubs) allProfileIds.add(r.profileId)
    for (const r of profileIdsFromCoAuthors) {
      if (r.profileId != null) allProfileIds.add(r.profileId)
    }
    profileIdsFromProposalsResolved.forEach((id) => allProfileIds.add(id))

    const period = khoangNamTaiChinh()
    let updated = 0
    for (const profileId of allProfileIds) {
      const result = await this.calculateTeacherKpi(profileId, period)
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
