import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'
import ProjectProposal from '#models/project_proposal'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import { getStrategyForOutput } from '#services/kpi_engine'
import type { CalculationResult, KpiContext, KpiOutput } from '#types/kpi'

const DEFAULT_QUOTA = 600

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
   * Tính toàn bộ KPI cho một giảng viên trong một năm học.
   */
  static async calculateTeacherKpi(
    profileId: number,
    academicYear: string
  ): Promise<{
    profileId: number
    academicYear: string
    totalHours: number
    metQuota: boolean
    quota: number
    breakdown: Array<{ type: string; id: number; hours: number; warnings: string[] }>
    allWarnings: string[]
  }> {
    const profile = await ScientificProfile.find(profileId)
    if (!profile) {
      return {
        profileId,
        academicYear,
        totalHours: 0,
        metQuota: false,
        quota: DEFAULT_QUOTA,
        breakdown: [],
        allWarnings: ['Không tìm thấy hồ sơ'],
      }
    }

    const isFemale = profile.gender?.toUpperCase() === 'NỮ'
    const context: KpiContext = { profileId, academicYear, isFemale }

    const outputs: KpiOutput[] = []

    const publications = await Publication.query()
      .where('profile_id', profileId)
      .where('academic_year', academicYear)
      .preload('publicationAuthors')
      .orderBy('id', 'asc')

    for (const pub of publications) {
      const authors = pub.publicationAuthors.map((a) => ({
        profileId: a.profileId,
        isMainAuthor: a.isMainAuthor,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
      }))
      outputs.push({
        type: 'PUBLICATION',
        publication: {
          id: pub.id,
          rank: pub.rank,
          quartile: pub.quartile,
          domesticRuleType: pub.domesticRuleType,
        },
        authors,
      })
    }

    const projects = await ProjectProposal.query()
      .where('owner_id', profile.userId)
      .where('status', 'APPROVED')
      .where('academic_year', academicYear)
      .orderBy('id', 'asc')

    for (const proj of projects) {
      outputs.push({
        type: 'PROJECT',
        project: {
          id: proj.id,
          level: proj.level,
          acceptanceGrade: proj.acceptanceGrade,
          cFactor: proj.cFactor,
        },
      })
    }

    const breakdown: Array<{ type: string; id: number; hours: number; warnings: string[] }> = []
    const allWarnings: string[] = []
    let totalHours = 0

    for (const output of outputs) {
      const result = await this.calculateOutputHours(output, context)
      totalHours += result.hours
      allWarnings.push(...result.warnings)
      const id = output.type === 'PUBLICATION' ? output.publication.id : output.type === 'PROJECT' ? output.project.id : 0
      breakdown.push({
        type: output.type,
        id,
        hours: result.hours,
        warnings: result.warnings,
      })
    }

    totalHours = Math.round(totalHours * 100) / 100
    const metQuota = totalHours >= DEFAULT_QUOTA

    return {
      profileId,
      academicYear,
      totalHours,
      metQuota,
      quota: DEFAULT_QUOTA,
      breakdown,
      allWarnings,
    }
  }

  /**
   * Tính lại KPI cho toàn bộ profile có dữ liệu trong năm học và upsert vào kpi_results.
   */
  static async recalcAcademicYear(academicYear: string): Promise<{ updated: number }> {
    const profileIdsFromPubs = await Publication.query()
      .where('academic_year', academicYear)
      .distinct('profile_id')
      .select('profile_id')
    const profileIdsFromProposals = await ProjectProposal.query()
      .where('academic_year', academicYear)
      .where('status', 'APPROVED')
      .distinct('owner_id')
      .select('owner_id')

    const userIds = new Set(profileIdsFromProposals.map((r) => r.ownerId))
    const profilesByUser = await ScientificProfile.query().whereIn('user_id', Array.from(userIds))
    const profileIdsFromProposalsResolved = new Set(profilesByUser.map((p) => p.id))
    const allProfileIds = new Set<number>()
    for (const r of profileIdsFromPubs) allProfileIds.add(r.profileId)
    profileIdsFromProposalsResolved.forEach((id) => allProfileIds.add(id))

    let updated = 0
    for (const profileId of allProfileIds) {
      const result = await this.calculateTeacherKpi(profileId, academicYear)
      await KpiResult.updateOrCreate(
        { profileId, academicYear },
        {
          profileId,
          academicYear,
          totalHours: result.totalHours,
          metQuota: result.metQuota,
          detail: {
            quota: result.quota,
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
