import * as fs from 'node:fs'
import * as path from 'node:path'
import XLSX from 'xlsx'
import Staff from '#models/staff'
import ScientificProfile from '#models/scientific_profile'
import PersonalProfile from '#models/personal_profile'
import User from '#models/user'

/** Dòng chuẩn từ sheet Bảng Nhân Viên. */
export type CanonicalStaffRow = {
  staffCode: string
  fullName: string
  email: string
  gender: 'MALE' | 'FEMALE' | null
}

export type NameGenderFixItem = {
  staffCode: string
  email: string
  excelFullName: string
  excelGender: 'MALE' | 'FEMALE' | null
  staffId: number | null
  userId: number | null
  sciId: number | null
  personalId: number | null
  before: {
    staffName: string | null
    staffGender: string | null
    userName: string | null
    personalName: string | null
    personalGender: string | null
    sciName: string | null
    sciGender: string | null
  }
  actions: string[]
}

export type NameGenderFixReport = {
  sourceFile: string
  sourceSheet: string
  excelRows: number
  matchedInDb: number
  needFix: number
  unchanged: number
  missingInDb: number
  applied: boolean
  staffUpdated: number
  sciUpdated: number
  personalUpdated: number
  userUpdated: number
  items: NameGenderFixItem[]
  missingStaffCodes: string[]
}

function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function normalizeGender(raw: string | null | undefined): 'MALE' | 'FEMALE' | null {
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

function normName(v: string | null | undefined): string {
  return (v || '').trim().replace(/\s+/g, ' ')
}

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return normName(a).toLowerCase() === normName(b).toLowerCase()
}

function sameGender(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeGender(a) === normalizeGender(b)
}

/**
 * Sửa lệch họ tên / giới tính gây ra bởi sheet DMNHanSu sai.
 * Nguồn chuẩn: sheet "Bảng Nhân Viên" (không dùng DMNHanSu).
 *
 * Mặc định chỉ sửa staffs + scientific_profiles (ảnh hưởng KPI ×1.2).
 * users / personal_profiles chỉ sửa khi bật cờ tương ứng.
 */
export default class StaffNameGenderFixService {
  static readonly DEFAULT_FILE = path.join(
    process.cwd(),
    'commands',
    'DanhMucDonVi_CHUAN_moii.xlsx'
  )
  static readonly DEFAULT_SHEET = 'Bảng Nhân Viên'

  static loadCanonicalRows(file: string, sheetName: string): CanonicalStaffRow[] {
    if (!fs.existsSync(file)) {
      throw new Error(`Không tìm thấy file: ${file}`)
    }
    const workbook = XLSX.readFile(file)
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      throw new Error(
        `Sheet "${sheetName}" không tồn tại. Có: ${workbook.SheetNames.join(', ')}`
      )
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    const out: CanonicalStaffRow[] = []
    for (const row of rows) {
      const staffCode = getCell(row, 'nv_id')
      const fullName = getCell(row, 'nv_hoten')
      if (!staffCode || !fullName) continue
      out.push({
        staffCode,
        fullName,
        email: getCell(row, 'nv_email').toLowerCase(),
        gender: normalizeGender(getCell(row, 'nv_gioitinh')),
      })
    }
    return out
  }

  static async run(options: {
    file?: string
    sheet?: string
    apply?: boolean
    fixPersonal?: boolean
    fixUsers?: boolean
  } = {}): Promise<NameGenderFixReport> {
    const sourceFile = options.file || this.DEFAULT_FILE
    const sourceSheet = options.sheet || this.DEFAULT_SHEET
    const apply = options.apply === true
    const fixPersonal = options.fixPersonal === true
    const fixUsers = options.fixUsers === true

    const canonical = this.loadCanonicalRows(sourceFile, sourceSheet)
    const byCode = new Map(canonical.map((r) => [r.staffCode, r]))

    const staffs = await Staff.query().orderBy('id', 'asc')
    const staffByCode = new Map(staffs.map((s) => [s.staffCode, s]))

    const userIds = staffs
      .map((s) => Number(s.userId))
      .filter((id) => Number.isFinite(id) && id > 0)
    const users = userIds.length
      ? await User.query().whereIn('id', userIds)
      : []
    const userById = new Map(users.map((u) => [Number(u.id), u]))

    const profiles = userIds.length
      ? await ScientificProfile.query().whereIn('user_id', userIds)
      : []
    const sciByUserId = new Map(profiles.map((p) => [Number(p.userId), p]))

    const personals = userIds.length
      ? await PersonalProfile.query().whereIn('user_id', userIds)
      : []
    const personalByUserId = new Map(personals.map((p) => [Number(p.userId), p]))

    const report: NameGenderFixReport = {
      sourceFile,
      sourceSheet,
      excelRows: canonical.length,
      matchedInDb: 0,
      needFix: 0,
      unchanged: 0,
      missingInDb: 0,
      applied: apply,
      staffUpdated: 0,
      sciUpdated: 0,
      personalUpdated: 0,
      userUpdated: 0,
      items: [],
      missingStaffCodes: [],
    }

    for (const row of canonical) {
      const staff = staffByCode.get(row.staffCode) || null
      if (!staff) {
        report.missingInDb += 1
        report.missingStaffCodes.push(row.staffCode)
        continue
      }
      report.matchedInDb += 1

      const userId = Number(staff.userId)
      const user =
        Number.isFinite(userId) && userId > 0 ? userById.get(userId) || null : null
      const sci = user ? sciByUserId.get(Number(user.id)) || null : null
      const personal = user ? personalByUserId.get(Number(user.id)) || null : null

      const item: NameGenderFixItem = {
        staffCode: row.staffCode,
        email: row.email || (staff.email || '').toLowerCase(),
        excelFullName: row.fullName,
        excelGender: row.gender,
        staffId: Number(staff.id),
        userId: user ? Number(user.id) : null,
        sciId: sci ? Number(sci.id) : null,
        personalId: personal ? Number(personal.id) : null,
        before: {
          staffName: staff.fullName,
          staffGender: staff.gender,
          userName: user?.fullName ?? null,
          personalName: personal?.fullName ?? null,
          personalGender: personal?.gender ?? null,
          sciName: sci?.fullName ?? null,
          sciGender: sci?.gender ?? null,
        },
        actions: [],
      }

      const staffNameDiff = !sameName(staff.fullName, row.fullName)
      const staffGenderDiff =
        row.gender != null && !sameGender(staff.gender, row.gender)
      const sciNameDiff = sci != null && !sameName(sci.fullName, row.fullName)
      const sciGenderDiff =
        sci != null && row.gender != null && !sameGender(sci.gender, row.gender)
      const personalNameDiff =
        personal != null && !sameName(personal.fullName, row.fullName)
      const personalGenderDiff =
        personal != null &&
        row.gender != null &&
        !sameGender(personal.gender, row.gender)
      const userNameDiff = user != null && !sameName(user.fullName, row.fullName)

      if (staffNameDiff || staffGenderDiff) {
        item.actions.push(
          `staffs: "${staff.fullName}"/${staff.gender || '-'} → "${row.fullName}"/${row.gender || '-'}`
        )
        if (apply) {
          if (staffNameDiff) staff.fullName = row.fullName
          if (staffGenderDiff && row.gender) staff.gender = row.gender
          await staff.save()
          report.staffUpdated += 1
        }
      }

      if (sci && (sciNameDiff || sciGenderDiff)) {
        item.actions.push(
          `scientific_profiles: "${sci.fullName}"/${sci.gender || '-'} → "${row.fullName}"/${row.gender || '-'}`
        )
        if (apply) {
          if (sciNameDiff) sci.fullName = row.fullName
          if (sciGenderDiff && row.gender) sci.gender = row.gender
          await sci.save()
          report.sciUpdated += 1
        }
      }

      if (fixPersonal && personal && (personalNameDiff || personalGenderDiff)) {
        item.actions.push(
          `personal_profiles: "${personal.fullName}"/${personal.gender || '-'} → "${row.fullName}"/${row.gender || '-'}`
        )
        if (apply) {
          if (personalNameDiff) personal.fullName = row.fullName
          if (personalGenderDiff && row.gender) personal.gender = row.gender
          await personal.save()
          report.personalUpdated += 1
        }
      } else if (!fixPersonal && personal && (personalNameDiff || personalGenderDiff)) {
        item.actions.push(
          `CHỈ BÁO CÁO personal_profiles lệch (không sửa): "${personal.fullName}"/${personal.gender || '-'}`
        )
      }

      if (fixUsers && user && userNameDiff) {
        item.actions.push(`users: "${user.fullName}" → "${row.fullName}"`)
        if (apply) {
          user.fullName = row.fullName
          await user.save()
          report.userUpdated += 1
        }
      } else if (!fixUsers && user && userNameDiff) {
        item.actions.push(`CHỈ BÁO CÁO users lệch (không sửa): "${user.fullName}"`)
      }

      // Chỉ ghi item khi có lệch thực sự cần chú ý
      const hasRealFix =
        staffNameDiff ||
        staffGenderDiff ||
        sciNameDiff ||
        sciGenderDiff ||
        (fixPersonal && (personalNameDiff || personalGenderDiff)) ||
        (fixUsers && userNameDiff)
      const hasReportOnly =
        (!fixPersonal && (personalNameDiff || personalGenderDiff)) ||
        (!fixUsers && userNameDiff)

      if (hasRealFix || hasReportOnly) {
        if (hasRealFix) report.needFix += 1
        else report.unchanged += 1
        report.items.push(item)
      } else {
        report.unchanged += 1
      }
    }

    // Cảnh báo staff trong DB có mã không nằm trong Excel chuẩn (không đụng)
    void byCode

    return report
  }
}
