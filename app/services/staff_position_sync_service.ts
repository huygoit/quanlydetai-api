import * as fs from 'node:fs'
import * as path from 'node:path'
import XLSX from 'xlsx'
import Staff from '#models/staff'
import User from '#models/user'
import StaffPosition from '#models/staff_position'
import { serializeStaffPositionIds } from '#utils/staff_position_ids'
import {
  timIdChucVuTrongChuoi,
  type CatalogChucVu,
} from '#utils/staff_position_excel_match'

export type StaffPositionExcelRow = {
  email: string
  staffCode: string
  fullName: string
  positionIds: string | null
  partyPositionIds: string | null
  unmatchedPosition: string[]
  unmatchedParty: string[]
}

export type StaffPositionSyncItem = {
  email: string
  staffCode: string | null
  staffId: number
  fullName: string | null
  matchedBy: 'staff_email' | 'user_email'
  before: { positionTitle: string | null; partyPosition: string | null }
  after: { positionTitle: string | null; partyPosition: string | null }
  changedFields: string[]
}

export type StaffPositionSyncReport = {
  sourceFile: string
  sourceSheet: string
  excelWithEmail: number
  matchedInDb: number
  needFix: number
  unchanged: number
  missingInDb: number
  applied: boolean
  staffUpdated: number
  items: StaffPositionSyncItem[]
  missingEmails: string[]
  duplicateEmails: string[]
  unmatchedNames: string[]
}

function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || '').trim() === (b || '').trim()
}

/**
 * Đồng bộ chức vụ staffs từ Excel — khớp email, lưu chuỗi ID catalog.
 *
 * POSITION: gộp 3 cột nv_chucvu + kiêm nhiệm + cao nhất
 * PARTY: nv_chucvudang
 */
export default class StaffPositionSyncService {
  static readonly DEFAULT_FILE = path.join(
    process.cwd(),
    'commands',
    'DanhMucDonVi_CHUAN_moii.xlsx'
  )
  static readonly DEFAULT_SHEET = 'Bảng Nhân Viên'

  static loadExcelRows(
    file: string,
    sheetName: string,
    positionCatalog: CatalogChucVu[],
    partyCatalog: CatalogChucVu[]
  ): {
    rows: StaffPositionExcelRow[]
    duplicateEmails: string[]
    unmatchedNames: string[]
  } {
    if (!fs.existsSync(file)) throw new Error(`Không tìm thấy file: ${file}`)
    const workbook = XLSX.readFile(file)
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" không tồn tại. Có: ${workbook.SheetNames.join(', ')}`)
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    const byEmail = new Map<string, StaffPositionExcelRow>()
    const duplicateEmails: string[] = []
    const unmatchedSet = new Set<string>()

    for (const row of rawRows) {
      const email = getCell(row, 'nv_email').toLowerCase()
      if (!email || !email.includes('@')) continue

      const posRaw = [
        getCell(row, 'nv_chucvu'),
        getCell(row, 'nv_chucvu_coquankiemnhiem'),
        getCell(row, 'nv_chucvu_coquancao nhat'),
      ]
        .filter(Boolean)
        .join('; ')

      const partyRaw = getCell(row, 'nv_chucvudang')
      const posHit = timIdChucVuTrongChuoi(posRaw, positionCatalog)
      const partyHit = timIdChucVuTrongChuoi(partyRaw, partyCatalog)

      for (const n of posHit.unmatched) unmatchedSet.add(`POSITION: ${n}`)
      for (const n of partyHit.unmatched) unmatchedSet.add(`PARTY: ${n}`)

      const next: StaffPositionExcelRow = {
        email,
        staffCode: getCell(row, 'nv_id'),
        fullName: getCell(row, 'nv_hoten'),
        positionIds: serializeStaffPositionIds(posHit.ids),
        partyPositionIds: serializeStaffPositionIds(partyHit.ids),
        unmatchedPosition: posHit.unmatched,
        unmatchedParty: partyHit.unmatched,
      }

      if (byEmail.has(email) && !duplicateEmails.includes(email)) duplicateEmails.push(email)
      byEmail.set(email, next)
    }

    return {
      rows: [...byEmail.values()],
      duplicateEmails,
      unmatchedNames: [...unmatchedSet].sort(),
    }
  }

  static async run(
    options: {
      file?: string
      sheet?: string
      apply?: boolean
    } = {}
  ): Promise<StaffPositionSyncReport> {
    const sourceFile = options.file || this.DEFAULT_FILE
    const sourceSheet = options.sheet || this.DEFAULT_SHEET
    const apply = options.apply === true

    const positions = await StaffPosition.query().where('kind', 'POSITION').where('status', 'ACTIVE')
    const parties = await StaffPosition.query().where('kind', 'PARTY').where('status', 'ACTIVE')
    const positionCatalog: CatalogChucVu[] = positions.map((p) => ({ id: p.id, name: p.name }))
    const partyCatalog: CatalogChucVu[] = parties.map((p) => ({ id: p.id, name: p.name }))

    const { rows: excelRows, duplicateEmails, unmatchedNames } = this.loadExcelRows(
      sourceFile,
      sourceSheet,
      positionCatalog,
      partyCatalog
    )

    const staffs = await Staff.query().orderBy('id', 'asc')
    const staffByEmail = new Map<string, Staff>()
    for (const s of staffs) {
      const e = (s.email || '').trim().toLowerCase()
      if (e) staffByEmail.set(e, s)
    }

    const userIds = staffs.map((s) => Number(s.userId)).filter((id) => Number.isFinite(id) && id > 0)
    const users = userIds.length ? await User.query().whereIn('id', userIds) : []
    const staffByUserEmail = new Map<string, Staff>()
    const staffByUserId = new Map<number, Staff>()
    for (const s of staffs) {
      const uid = Number(s.userId)
      if (Number.isFinite(uid) && uid > 0) staffByUserId.set(uid, s)
    }
    for (const u of users) {
      const e = (u.email || '').trim().toLowerCase()
      if (!e) continue
      const staff = staffByUserId.get(Number(u.id))
      if (staff) staffByUserEmail.set(e, staff)
    }

    const report: StaffPositionSyncReport = {
      sourceFile,
      sourceSheet,
      excelWithEmail: excelRows.length,
      matchedInDb: 0,
      needFix: 0,
      unchanged: 0,
      missingInDb: 0,
      applied: apply,
      staffUpdated: 0,
      items: [],
      missingEmails: [],
      duplicateEmails,
      unmatchedNames,
    }

    for (const row of excelRows) {
      let staff = staffByEmail.get(row.email) || null
      let matchedBy: StaffPositionSyncItem['matchedBy'] = 'staff_email'
      if (!staff) {
        staff = staffByUserEmail.get(row.email) || null
        matchedBy = 'user_email'
      }
      if (!staff) {
        report.missingInDb += 1
        report.missingEmails.push(row.email)
        continue
      }

      report.matchedInDb += 1

      const after = {
        positionTitle: row.positionIds,
        partyPosition: row.partyPositionIds,
      }
      const before = {
        positionTitle: staff.positionTitle,
        partyPosition: staff.partyPosition,
      }

      const changedFields: string[] = []
      if (!sameText(before.positionTitle, after.positionTitle)) changedFields.push('positionTitle')
      if (!sameText(before.partyPosition, after.partyPosition)) changedFields.push('partyPosition')

      if (changedFields.length === 0) {
        report.unchanged += 1
        continue
      }

      report.needFix += 1
      report.items.push({
        email: row.email,
        staffCode: staff.staffCode || row.staffCode || null,
        staffId: staff.id,
        fullName: staff.fullName || row.fullName || null,
        matchedBy,
        before,
        after,
        changedFields,
      })

      if (apply) {
        staff.positionTitle = after.positionTitle
        staff.partyPosition = after.partyPosition
        staff.concurrentPosition = null
        staff.highestPosition = null
        await staff.save()
        report.staffUpdated += 1
      }
    }

    return report
  }
}
