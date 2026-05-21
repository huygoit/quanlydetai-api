import ScientificProfile from '#models/scientific_profile'
import { resolveScientificProfileDegreeKey } from '#constants/scientific_profile_catalog'

export type DegreeBackfillReport = {
  total: number
  mapped: number
  unchanged: number
  updated: number
  unmatched: Array<{ profileId: number; oldDegree: string | null }>
  dryRun: boolean
}

/**
 * Đổi cột degree từ nhãn cũ (Tiến sĩ, …) sang key (TIEN_SI, …).
 */
export async function backfillScientificProfileDegreeKeys(
  dryRun: boolean
): Promise<DegreeBackfillReport> {
  const profiles = await ScientificProfile.query().orderBy('id', 'asc')
  const report: DegreeBackfillReport = {
    total: profiles.length,
    mapped: 0,
    unchanged: 0,
    updated: 0,
    unmatched: [],
    dryRun,
  }

  for (const profile of profiles) {
    const old = profile.degree
    if (!old?.trim()) {
      report.unchanged++
      continue
    }

    const key = resolveScientificProfileDegreeKey(old)
    if (!key) {
      report.unmatched.push({ profileId: profile.id, oldDegree: old })
      continue
    }

    report.mapped++
    if (profile.degree === key) {
      report.unchanged++
      continue
    }

    if (!dryRun) {
      profile.degree = key
      await profile.save()
    }
    report.updated++
  }

  return report
}
