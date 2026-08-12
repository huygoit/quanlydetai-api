import Staff from '#models/staff'
import ScientificProfile from '#models/scientific_profile'
import { resolveScientificProfileAcademicTitleKey } from '#constants/scientific_profile_catalog'
import User from '#models/user'
import { DateTime } from 'luxon'
import StaffPosition from '#models/staff_position'
import { parseStaffPositionIds } from '#utils/staff_position_ids'

const DEFAULT_ORGANIZATION = 'Trường Đại học Sư phạm - Đại học Đà Nẵng'

export interface StaffProfileSyncOptions {
  dryRun?: boolean
  autoLinkByEmail?: boolean
}

export interface StaffProfileSyncReport {
  totalStaff: number
  totalStaffWithUser: number
  normalizedStaffGender: number
  autoLinkedByEmail: number
  skippedUserAlreadyLinked: number
  created: number
  updated: number
  unchanged: number
  skippedMissingUser: number
  errors: Array<{ staffId: number; staffCode: string; reason: string }>
}

type BaseSyncPayload = {
  fullName: string
  dateOfBirth: DateTime | null
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
  if (s === 'f' || s.includes('nu') || s.includes('female')) return 'FEMALE'
  if (s === 'm' || s.includes('nam') || s.includes('male')) return 'MALE'
  return null
}

function fitText(raw: string | null | undefined, maxLength: number): string | null {
  const s = (raw || '').trim()
  if (!s) return null
  return s.length > maxLength ? s.slice(0, maxLength) : s
}

function pickWorkEmail(staffEmail: string | null, user: User | null, staffCode: string): string {
  const e1 = (staffEmail || '').trim()
  if (e1.includes('@')) return e1
  const e2 = (user?.email || '').trim()
  if (e2.includes('@')) return e2
  return `${staffCode.toLowerCase()}@staff.local`
}

function toDate(v: unknown): DateTime | null {
  if (!v) return null
  if (DateTime.isDateTime(v)) return v
  if (v instanceof Date) return DateTime.fromJSDate(v)
  const maybe: any = v as any
  if (typeof maybe?.toJSDate === 'function') return DateTime.fromJSDate(maybe.toJSDate())
  return null
}

function resolveChucVuText(
  raw: string | null | undefined,
  idToName: Map<number, string>
): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  if (/^\d+(,\d+)*$/.test(trimmed)) {
    const names = parseStaffPositionIds(trimmed)
      .map((id) => idToName.get(id))
      .filter(Boolean) as string[]
    if (names.length) return fitText(names.join(', '), 100)
    return null
  }
  return fitText(trimmed, 100)
}

function buildPayload(
  staff: Staff,
  user: User | null,
  positionIdToName: Map<number, string>
): BaseSyncPayload {
  const chucVuText =
    resolveChucVuText(staff.positionTitle, positionIdToName) ||
    fitText(staff.currentJob, 100)

  return {
    fullName: staff.fullName?.trim() || user?.fullName?.trim() || `Nhân sự ${staff.staffCode}`,
    dateOfBirth: toDate(staff.dateOfBirth),
    gender: normalizeGender(staff.gender),
    workEmail: pickWorkEmail(staff.email, user, staff.staffCode),
    phone: staff.phone?.trim() || null,
    organization: DEFAULT_ORGANIZATION,
    department: staff.departmentName?.trim() || null,
    currentTitle: chucVuText,
    managementRole: null,
    academicTitle: resolveScientificProfileAcademicTitleKey(staff.academicTitle),
  }
}

function toIsoDate(v: unknown): string | null {
  if (!v) return null
  const maybe: any = v as any
  if (DateTime.isDateTime(maybe)) return maybe.toISODate()
  if (maybe instanceof Date) return DateTime.fromJSDate(maybe).toISODate()
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
    const autoLinkByEmail = options.autoLinkByEmail !== false
    const report: StaffProfileSyncReport = {
      totalStaff: 0,
      totalStaffWithUser: 0,
      normalizedStaffGender: 0,
      autoLinkedByEmail: 0,
      skippedUserAlreadyLinked: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skippedMissingUser: 0,
      errors: [],
    }

    const users = await User.query().select('id', 'email')
    const userById = new Map<number, User>()
    const userByEmail = new Map<string, User>()
    for (const user of users) {
      userById.set(Number(user.id), user)
      const email = (user.email || '').trim().toLowerCase()
      if (email) userByEmail.set(email, user)
    }

    const staffs = await Staff.query().orderBy('id', 'asc')
    report.totalStaff = staffs.length
    const linkedUserToStaff = new Map<number, number>()
    for (const staff of staffs) {
      const uid = Number(staff.userId)
      if (Number.isFinite(uid) && uid > 0 && !linkedUserToStaff.has(uid)) {
        linkedUserToStaff.set(uid, Number(staff.id))
      }
    }

    const resolvedUserIds: number[] = []
    const resolvedUserByStaffId = new Map<number, User>()

    for (const staff of staffs) {
      const normalizedGender = normalizeGender(staff.gender)
      const currentGender = (staff.gender || '').trim().toUpperCase()
      if (normalizedGender && currentGender !== normalizedGender) {
        if (!dryRun) {
          staff.gender = normalizedGender
          await staff.save()
        }
        staff.gender = normalizedGender
        report.normalizedStaffGender += 1
      }

      let user: User | null = null
      const currentUserId = Number(staff.userId)
      if (Number.isFinite(currentUserId) && currentUserId > 0) {
        user = userById.get(currentUserId) || null
      }

      if (!user && autoLinkByEmail) {
        const email = (staff.email || '').trim().toLowerCase()
        if (email) {
          const matched = userByEmail.get(email) || null
          if (matched) {
            const matchedId = Number(matched.id)
            const linkedStaffId = linkedUserToStaff.get(matchedId)
            if (linkedStaffId && linkedStaffId !== Number(staff.id)) {
              report.skippedUserAlreadyLinked += 1
              continue
            }
            if (!dryRun) {
              try {
                staff.userId = matchedId
                await staff.save()
              } catch (error) {
                report.errors.push({
                  staffId: Number(staff.id),
                  staffCode: staff.staffCode,
                  reason: error instanceof Error ? error.message : 'Lỗi không xác định khi gán user_id',
                })
                continue
              }
            }
            staff.userId = matchedId
            linkedUserToStaff.set(matchedId, Number(staff.id))
            user = matched
            report.autoLinkedByEmail += 1
          }
        }
      }

      if (!user) continue
      resolvedUserByStaffId.set(Number(staff.id), user)
      resolvedUserIds.push(Number(user.id))
    }

    report.totalStaffWithUser = resolvedUserIds.length

    if (resolvedUserIds.length === 0) {
      return report
    }

    const userIds = Array.from(new Set(resolvedUserIds))
    const profiles = await ScientificProfile.query().whereIn('user_id', userIds)
    const profileByUserId = new Map<number, ScientificProfile>()
    for (const p of profiles) profileByUserId.set(Number(p.userId), p)

    const catalog = await StaffPosition.query().where('status', 'ACTIVE')
    const positionIdToName = new Map<number, string>()
    for (const c of catalog) positionIdToName.set(c.id, c.name)

    for (const staff of staffs) {
      try {
        const uid = Number(staff.userId)
        const user = resolvedUserByStaffId.get(Number(staff.id)) || null
        if (!user) {
          report.skippedMissingUser += 1
          continue
        }

        const payload = buildPayload(staff, user, positionIdToName)
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

