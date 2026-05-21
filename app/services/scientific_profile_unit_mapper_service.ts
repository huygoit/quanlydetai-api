import Department from '#models/department'
import ScientificProfile from '#models/scientific_profile'
import type { DepartmentType } from '#models/department'
import {
  getUdnAffiliationUnitLabel,
  normalizeMatchText,
  resolveUdnAffiliationUnitKey,
  type UdnAffiliationUnitKey,
} from '#constants/udn_affiliation_units'

/** Loại department dùng cho field faculty (khoa/phòng/ban). */
const FACULTY_DEPARTMENT_TYPES: DepartmentType[] = [
  'FACULTY',
  'OFFICE',
  'CENTER',
  'BOARD',
  'COUNCIL',
  'OTHER',
]

export type OrganizationMapResult = {
  organizationId: UdnAffiliationUnitKey | null
  organization: string | null
  score: number
  reason: string
}

export type DepartmentMapResult = {
  departmentId: number | null
  faculty: string | null
  score: number
  reason: string
}

/**
 * Map text organization cũ → key constant + nhãn chuẩn.
 */
export function mapOrganizationText(text: string | null | undefined): OrganizationMapResult {
  const raw = String(text ?? '').trim()
  if (!raw) {
    return { organizationId: null, organization: null, score: 0, reason: 'empty' }
  }

  const key = resolveUdnAffiliationUnitKey(raw)
  if (key) {
    return {
      organizationId: key,
      organization: getUdnAffiliationUnitLabel(key),
      score: 100,
      reason: 'resolved_key',
    }
  }

  return {
    organizationId: null,
    organization: raw,
    score: 0,
    reason: 'no_match',
  }
}

/**
 * Map text faculty cũ → department_id (ACTIVE, không phải UNIVERSITY).
 */
export async function mapFacultyText(text: string | null | undefined): Promise<DepartmentMapResult> {
  const raw = String(text ?? '').trim()
  if (!raw) {
    return { departmentId: null, faculty: null, score: 0, reason: 'empty' }
  }

  const norm = normalizeMatchText(raw)
  const departments = await Department.query()
    .where('status', 'ACTIVE')
    .whereIn('type', FACULTY_DEPARTMENT_TYPES)
    .orderBy('display_order', 'asc')
    .orderBy('name', 'asc')

  let best: { dept: Department; score: number } | null = null

  for (const dept of departments) {
    const candidates = [dept.name, dept.shortName, dept.code].filter(Boolean) as string[]
    for (const candidate of candidates) {
      const cNorm = normalizeMatchText(candidate)
      if (!cNorm) continue
      let score = 0
      if (norm === cNorm) score = 1000 + cNorm.length
      else if (norm.includes(cNorm) || cNorm.includes(norm)) score = Math.min(norm.length, cNorm.length)
      if (score > 0 && (!best || score > best.score)) {
        best = { dept, score }
      }
    }
  }

  if (best) {
    return {
      departmentId: best.dept.id,
      faculty: best.dept.name,
      score: best.score,
      reason: 'fuzzy_department',
    }
  }

  return {
    departmentId: null,
    faculty: raw,
    score: 0,
    reason: 'no_match',
  }
}

export type ProfileUnitBackfillRow = {
  profileId: number
  userId: number
  oldOrganization: string
  oldFaculty: string | null
  organizationId: UdnAffiliationUnitKey | null
  organization: string | null
  departmentId: number | null
  faculty: string | null
  orgReason: string
  facultyReason: string
}

export type ProfileUnitBackfillReport = {
  total: number
  organizationMatched: number
  facultyMatched: number
  unchanged: number
  updated: number
  dryRun: boolean
  rows: ProfileUnitBackfillRow[]
  unmatchedOrganization: ProfileUnitBackfillRow[]
  unmatchedFaculty: ProfileUnitBackfillRow[]
}

/**
 * Backfill organization_id + department_id cho toàn bộ scientific_profiles.
 */
export async function backfillScientificProfileUnits(
  dryRun: boolean
): Promise<ProfileUnitBackfillReport> {
  const profiles = await ScientificProfile.query().orderBy('id', 'asc')

  const report: ProfileUnitBackfillReport = {
    total: profiles.length,
    organizationMatched: 0,
    facultyMatched: 0,
    unchanged: 0,
    updated: 0,
    dryRun,
    rows: [],
    unmatchedOrganization: [],
    unmatchedFaculty: [],
  }

  for (const profile of profiles) {
    const org = mapOrganizationText(profile.organization)
    const fac = await mapFacultyText(profile.faculty)

    const row: ProfileUnitBackfillRow = {
      profileId: profile.id,
      userId: profile.userId,
      oldOrganization: profile.organization,
      oldFaculty: profile.faculty,
      organizationId: org.organizationId,
      organization: org.organization,
      departmentId: fac.departmentId,
      faculty: fac.faculty,
      orgReason: org.reason,
      facultyReason: fac.reason,
    }
    report.rows.push(row)

    if (org.organizationId) report.organizationMatched++
    else if (profile.organization?.trim()) report.unmatchedOrganization.push(row)

    if (fac.departmentId) report.facultyMatched++
    else if (profile.faculty?.trim()) report.unmatchedFaculty.push(row)

    const willChange =
      profile.organizationId !== org.organizationId ||
      profile.organization !== org.organization ||
      profile.departmentId !== fac.departmentId ||
      profile.faculty !== fac.faculty

    if (!willChange) {
      report.unchanged++
      continue
    }

    if (!dryRun) {
      profile.organizationId = org.organizationId
      profile.organization = org.organization ?? profile.organization
      profile.departmentId = fac.departmentId
      profile.faculty = fac.faculty
      await profile.save()
    }
    report.updated++
  }

  return report
}
