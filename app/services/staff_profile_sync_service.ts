import Staff from '#models/staff'
import ScientificProfile from '#models/scientific_profile'
import type User from '#models/user'

const DEFAULT_ORGANIZATION = 'Trường Đại học Sư phạm - Đại học Đà Nẵng'

export interface StaffProfileSyncOptions {
  dryRun?: boolean
}

export interface StaffProfileSyncReport {
  totalStaffWithUser: number
  created: number
  updated: number
  unchanged: number
  skippedMissingUser: number
  errors: Array<{ staffId: number; staffCode: string; reason: string }>
}

type BaseSyncPayload = {
  fullName: string
  dateOfBirth: Date | null
  gender: string | null
  workEmail: string
  phone: string | null
  organization: string
  department: string | null
  currentTitle: string | null
  managementRole: string | null
  academicTitle: string | null
}

function normalizeGender(raw: string | null): string | null {
  if (!raw) return null
  const s = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
  if (!s) return null
  if (s.includes('nu')) return 'NỮ'
  if (s.includes('nam')) return 'NAM'
  return raw.trim().toUpperCase()
}

function pickWorkEmail(staffEmail: string | null, user: User | null, staffCode: string): string {
  const e1 = (staffEmail || '').trim()
  if (e1.includes('@')) return e1
  const e2 = (user?.email || '').trim()
  if (e2.includes('@')) return e2
  return `${staffCode.toLowerCase()}@staff.local`
}

function toDate(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  const maybe: any = v as any
  if (typeof maybe?.toJSDate === 'function') return maybe.toJSDate()
  return null
}

function buildPayload(staff: Staff, user: User | null): BaseSyncPayload {
  return {
    fullName: staff.fullName?.trim() || user?.fullName?.trim() || `Nhân sự ${staff.staffCode}`,
    dateOfBirth: toDate(staff.dateOfBirth),
    gender: normalizeGender(staff.gender),
    workEmail: pickWorkEmail(staff.email, user, staff.staffCode),
    phone: staff.phone?.trim() || null,
    organization: DEFAULT_ORGANIZATION,
    department: staff.departmentName?.trim() || null,
    currentTitle: staff.positionTitle?.trim() || staff.currentJob?.trim() || null,
    managementRole: staff.concurrentPosition?.trim() || null,
    academicTitle: staff.academicTitle?.trim() || null,
  }
}

function toIsoDate(v: unknown): string | null {
  if (!v) return null
  const maybe: any = v as any
  if (maybe instanceof Date) return maybe.toISOString().slice(0, 10)
  if (typeof maybe?.toISODate === 'function') return maybe.toISODate()
  return null
}

function diffProfile(profile: ScientificProfile, payload: BaseSyncPayload): Partial<BaseSyncPayload> {
  const updates: Partial<BaseSyncPayload> = {}

  if ((profile.fullName || '').trim() !== payload.fullName) updates.fullName = payload.fullName
  if (toIsoDate(profile.dateOfBirth) !== toIsoDate(payload.dateOfBirth)) updates.dateOfBirth = payload.dateOfBirth
  if ((profile.gender || null) !== payload.gender) updates.gender = payload.gender
  if ((profile.workEmail || '').trim() !== payload.workEmail) updates.workEmail = payload.workEmail
  if ((profile.phone || null) !== payload.phone) updates.phone = payload.phone
  if ((profile.organization || '').trim() !== payload.organization) updates.organization = payload.organization
  if ((profile.department || null) !== payload.department) updates.department = payload.department
  if ((profile.currentTitle || null) !== payload.currentTitle) updates.currentTitle = payload.currentTitle
  if ((profile.managementRole || null) !== payload.managementRole)
    updates.managementRole = payload.managementRole
  if ((profile.academicTitle || null) !== payload.academicTitle) updates.academicTitle = payload.academicTitle

  return updates
}

export default class StaffProfileSyncService {
  static async sync(options: StaffProfileSyncOptions = {}): Promise<StaffProfileSyncReport> {
    const dryRun = options.dryRun === true
    const report: StaffProfileSyncReport = {
      totalStaffWithUser: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skippedMissingUser: 0,
      errors: [],
    }

    const staffs = await Staff.query().whereNotNull('user_id').preload('user').orderBy('id', 'asc')
    report.totalStaffWithUser = staffs.length

    const userIds = Array.from(
      new Set(staffs.map((s) => Number(s.userId)).filter((v) => Number.isFinite(v) && v > 0))
    )
    const profiles = await ScientificProfile.query().whereIn('user_id', userIds)
    const profileByUserId = new Map<number, ScientificProfile>()
    for (const p of profiles) profileByUserId.set(Number(p.userId), p)

    for (const staff of staffs) {
      try {
        const uid = Number(staff.userId)
        const user = (staff as any).user ?? null
        if (!user) {
          report.skippedMissingUser += 1
          continue
        }

        const payload = buildPayload(staff, user)
        const existing = profileByUserId.get(uid)

        if (!existing) {
          if (!dryRun) {
            const created = await ScientificProfile.create({
              userId: uid,
              ...payload,
            })
            profileByUserId.set(uid, created)
          }
          report.created += 1
          continue
        }

        const updates = diffProfile(existing, payload)
        if (Object.keys(updates).length === 0) {
          report.unchanged += 1
          continue
        }

        if (!dryRun) {
          existing.merge(updates)
          await existing.save()
        }
        report.updated += 1
      } catch (error) {
        report.errors.push({
          staffId: Number(staff.id),
          staffCode: staff.staffCode,
          reason: error instanceof Error ? error.message : 'Lỗi không xác định',
        })
      }
    }

    return report
  }
}

