import Publication from '#models/publication'
import ProjectProposal from '#models/project_proposal'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import { getStrategyForOutput } from '#services/kpi_engine'
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
   * Tính toàn bộ KPI cho một giảng viên: mọi công bố của hồ sơ + mọi đề tài đã duyệt của user (không lọc theo năm học).
   * `academicYear` chỉ còn để trả về/ghi cache `kpi_results` theo khóa cũ của API.
   */
  static async calculateTeacherKpi(
    profileId: number,
    academicYear: string
  ): Promise<{
    profileId: number
    academicYear: string
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
        academicYear,
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
      academicYear,
      isFemale,
      profileFullName: profile.fullName ?? null,
    }

    const outputs: KpiOutput[] = []

    const publications = await Publication.query()
      .where('profile_id', profileId)
      .preload('publicationAuthors')
      .orderBy('id', 'asc')

    for (const pub of publications) {
      const authors = pub.publicationAuthors.map((a) => ({
        profileId: a.profileId,
        fullName: a.fullName,
        isMainAuthor: a.isMainAuthor,
        isCorresponding: a.isCorresponding,
        affiliationType: a.affiliationType,
        isMultiAffiliationOutsideUdn: a.isMultiAffiliationOutsideUdn,
      }))
      outputs.push({
        type: 'PUBLICATION',
        publication: {
          id: pub.id,
          ownerProfileId: pub.profileId,
          researchOutputTypeId: pub.researchOutputTypeId,
          hdgsnnScore: pub.hdgsnnScore != null ? Number(pub.hdgsnnScore) : null,
        },
        authors,
      })
    }

    const projects = await ProjectProposal.query()
      .where('owner_id', profile.userId)
      .where('status', 'APPROVED')
      .orderBy('id', 'asc')

    for (const proj of projects) {
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
      academicYear,
      totalHours,
      totalPoints,
      metQuota,
      quota: DEFAULT_QUOTA,
      breakdown,
      allWarnings,
    }
  }

  /**
   * Tính lại KPI và upsert `kpi_results` theo khóa `academicYear` (query param).
   * Tổng giờ/điểm không phụ thuộc năm học — mọi profile có công bố hoặc đề tài duyệt đều được cập nhật.
   */
  static async recalcAcademicYear(academicYear: string): Promise<{ updated: number }> {
    const profileIdsFromPubs = await Publication.query().distinct('profile_id').select('profile_id')
    const profileIdsFromProposals = await ProjectProposal.query()
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
