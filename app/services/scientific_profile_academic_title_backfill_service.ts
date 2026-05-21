import ScientificProfile from '#models/scientific_profile'
import { resolveScientificProfileAcademicTitleKey } from '#constants/scientific_profile_catalog'

export type AcademicTitleBackfillReport = {
  total: number
  mapped: number
  unchanged: number
  updated: number
  unmatched: Array<{ profileId: number; oldTitle: string | null }>
  dryRun: boolean
}

export async function backfillScientificProfileAcademicTitleKeys(
  dryRun: boolean
): Promise<AcademicTitleBackfillReport> {
  const profiles = await ScientificProfile.query().orderBy('id', 'asc')
  const report: AcademicTitleBackfillReport = {
    total: profiles.length,
    mapped: 0,
    unchanged: 0,
    updated: 0,
    unmatched: [],
    dryRun,
  }

  for (const profile of profiles) {
    const old = profile.academicTitle
    if (!old?.trim()) {
      report.unchanged++
      continue
    }

    const key = resolveScientificProfileAcademicTitleKey(old)
    if (!key) {
      report.unmatched.push({ profileId: profile.id, oldTitle: old })
      continue
    }

    report.mapped++
    if (profile.academicTitle === key) {
      report.unchanged++
      continue
    }

    if (!dryRun) {
      profile.academicTitle = key
      await profile.save()
    }
    report.updated++
  }

  return report
}
