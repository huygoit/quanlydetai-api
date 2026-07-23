import path from 'node:path'
import { DateTime } from 'luxon'
import XLSX from 'xlsx'
import db from '@adonisjs/lucid/services/db'
import Department from '#models/department'
import Publication from '#models/publication'
import PublicationAuthor, {
  type AffiliationType,
  type AuthorGender,
} from '#models/publication_author'
import ResearchOutputType from '#models/research_output_type'
import ScientificProfile from '#models/scientific_profile'
import Staff from '#models/staff'
import Student from '#models/student'
import type { UdnAffiliationUnitKey } from '#constants/udn_affiliation_units'

type ImportOptions = {
  file: string
  sheet?: string
  dryRun?: boolean
  updateExisting?: boolean
}

export type LegacyPublicationImportSummary = {
  totalPublications: number
  createdPublications: number
  updatedPublications: number
  existingPublications: number
  skippedPublications: number
  createdAuthors: number
  mappedDepartments: number
  unresolvedDepartments: number
  inferredGender: { male: number; female: number; unresolved: number }
  inferredA: { a1: number; a15: number; a2: number; unresolved: number }
  warnings: string[]
  errors: string[]
}

type LegacyPublicationRow = {
  maBaiBao: string
  tenBaiBao: string
  tongThanhVien: number | null
  maLoaiCongViec: string
  tenLoaiPhanCap: string
  tenTapChi: string
  ngayDang: string
  namXuatBan: number | null
  nhaXuatBan: string
  issue: string
  pages: string
  url: string
  trangThai: string
  yeuCauHieuChinh: string
  canBoKeKhai: string
  thoiDiemKeKhai: string
  authors: LegacyAuthorRow[]
}

type LegacyAuthorRow = {
  maDonVi: string
  tenDonVi: string
  maCanBo: string
  hoTenCanBo: string
  tenVaiTro: string
  gioNckh: number | null
}

type TypeMapping = {
  code: string
  section: 1 | 2 | 3 | 4 | 5
  rank: 'ISI' | 'SCOPUS' | 'DOMESTIC' | 'OTHER' | null
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'NO_Q' | null
  publicationType: 'JOURNAL' | 'CONFERENCE'
  domesticRuleType: 'HDGSNN_SCORE' | 'CONFERENCE_ISBN' | null
  hdgsnnScore: number | null
}

type Identity = {
  profileId: number | null
  studentId: number | null
  departmentId: number | null
  gender: AuthorGender | null
}

type PreparedAuthor = LegacyAuthorRow &
  Identity & {
    isTopAuthor: boolean
    isCorresponding: boolean
    departmentMatchedFromExcel: boolean
    genderInferred: AuthorGender | null
    modifier: number | null
    affiliationType: AffiliationType
    affiliationUnits: UdnAffiliationUnitKey[]
    isMultiAffiliationOutsideUdn: boolean
  }

type InferenceResult = {
  a: 1 | 1.5 | 2
  modifiers: number[]
}

const SOURCE = 'INTERNAL'
const SOURCE_ID_PREFIX = 'IMPORT_BAIBAO_'
const MODIFIERS = [1, 1.2, 0.5, 0.6] as const

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeLoose(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

function normalizeDepartmentName(value: unknown): string {
  return normalizeLoose(value)
    .replace(/\bgd\b/g, 'giao duc')
    .replace(/\bctxh\b/g, 'cong tac xa hoi')
    .replace(/\bkhxh\b/g, 'khoa hoc xa hoi')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(String(value).replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

function parseDate(value: unknown): string {
  const raw = normalizeText(value).replace(/^ngày đăng:\s*/i, '')
  if (!raw) return ''
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!match) return ''
  return `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`
}

function isTopAuthor(role: string): boolean {
  const value = normalizeLoose(role)
  return value.includes('tac gia dung dau') || value.includes('tac gia chinh')
}

function isCorresponding(role: string): boolean {
  return normalizeLoose(role).includes('tac gia lien he')
}

function normalizeGender(value: unknown): AuthorGender | null {
  const gender = normalizeLoose(value)
  if (!gender) return null
  if (gender === 'nu' || gender === 'female' || gender === 'f') return 'FEMALE'
  if (gender === 'nam' || gender === 'male' || gender === 'm') return 'MALE'
  return null
}

/**
 * Suy giới tính từ họ tên khi chưa có hồ sơ / chưa suy từ giờ:
 * - Tên có âm tiết "thị" (không phân biệt hoa thường, bỏ dấu) → nữ
 * - Còn lại → nam
 */
function inferGenderFromFullName(fullName: string): AuthorGender {
  const loose = normalizeLoose(fullName)
  if (/(^|\s)thi(\s|$)/.test(loose)) return 'FEMALE'
  return 'MALE'
}

function parseCombinedSheet(sheet: XLSX.WorkSheet): LegacyPublicationRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  })
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeLoose(cell) === 'ma bai bao')
  )
  if (headerIndex < 0) {
    throw new Error('Không tìm thấy dòng tiêu đề có cột "Mã bài báo".')
  }

  const publications: LegacyPublicationRow[] = []
  let current: LegacyPublicationRow | null = null

  for (const row of rows.slice(headerIndex + 1)) {
    const code = normalizeText(row[1])
    if (code) {
      current = {
        maBaiBao: code,
        tenBaiBao: normalizeText(row[2]),
        tongThanhVien: toNumber(row[3]),
        maLoaiCongViec: normalizeText(row[4]),
        tenLoaiPhanCap: normalizeText(row[5]),
        tenTapChi: normalizeText(row[6]),
        ngayDang: '',
        namXuatBan: toNumber(row[7]),
        nhaXuatBan: normalizeText(row[8]),
        issue: '',
        pages: '',
        url: '',
        trangThai: normalizeText(row[15]),
        yeuCauHieuChinh: normalizeText(row[16]),
        canBoKeKhai: normalizeText(row[17]),
        thoiDiemKeKhai: parseDate(row[18]),
        authors: [],
      }
      publications.push(current)
    }
    if (!current) continue

    const journalDetail = normalizeText(row[6])
    if (/^ngày đăng:/i.test(journalDetail)) {
      current.ngayDang = parseDate(journalDetail)
    } else if (/^số\s+/i.test(journalDetail)) {
      current.issue = journalDetail.replace(/^số\s+/i, '').trim()
    } else if (/^vị trí trang:/i.test(journalDetail)) {
      const pagesOrUrl = journalDetail.replace(/^vị trí trang:/i, '').trim()
      if (/^https?:\/\//i.test(pagesOrUrl)) current.url = pagesOrUrl
      else current.pages = pagesOrUrl
    }

    const authorName = normalizeText(row[12])
    if (authorName) {
      current.authors.push({
        maDonVi: normalizeText(row[9]),
        tenDonVi: normalizeText(row[10]),
        maCanBo: normalizeText(row[11]),
        hoTenCanBo: authorName,
        tenVaiTro: normalizeText(row[13]),
        gioNckh: toNumber(row[14]),
      })
    }
  }

  return publications
}

function mapType(row: LegacyPublicationRow): TypeMapping | null {
  const type = normalizeLoose(row.maLoaiCongViec)
  const level = normalizeLoose(row.tenLoaiPhanCap)

  if (type.includes('bbmuc1')) {
    const quartile = level.includes('q1')
      ? 'Q1'
      : level.includes('q2')
        ? 'Q2'
        : level.includes('q3')
          ? 'Q3'
          : level.includes('q4')
            ? 'Q4'
            : 'NO_Q'
    const code = { Q1: 'QD_R2', Q2: 'QD_R3', Q3: 'QD_R4', Q4: 'QD_R5', NO_Q: 'QD_R6' }[quartile]
    return {
      code,
      section: 1,
      rank: 'ISI',
      quartile,
      publicationType: 'JOURNAL',
      domesticRuleType: null,
      hdgsnnScore: null,
    }
  }

  if (type.includes('bbmuc2')) {
    const quartile = level.includes('q1')
      ? 'Q1'
      : level.includes('q2')
        ? 'Q2'
        : level.includes('q3')
          ? 'Q3'
          : level.includes('q4')
            ? 'Q4'
            : 'NO_Q'
    const code = {
      Q1: 'QD_R7',
      Q2: 'QD_R8',
      Q3: 'QD_R9',
      Q4: 'QD_R10',
      NO_Q: 'QD_R11',
    }[quartile]
    return {
      code,
      section: 2,
      rank: 'SCOPUS',
      quartile,
      publicationType: 'JOURNAL',
      domesticRuleType: null,
      hdgsnnScore: null,
    }
  }

  if (type.includes('bbmuc3')) {
    const code = level.includes('3.1') ? 'QD_R12' : level.includes('3.2') ? 'QD_R13' : null
    if (!code) return null
    return {
      code,
      section: 3,
      rank: 'OTHER',
      quartile: null,
      publicationType: 'CONFERENCE',
      domesticRuleType: null,
      hdgsnnScore: null,
    }
  }

  if (type.includes('bbmuc4')) {
    // Mục 4 QĐ 1883: gồm cả 4.1 (có điểm HĐGS trong nhãn) và 4.2 (ISSN khác).
    const scoreMatch = row.tenLoaiPhanCap.match(/-\s*(0[.,]25|0[.,]5|0[.,]75|1[.,]0|1[.,]25)\s*$/)
    let score = scoreMatch ? Number(scoreMatch[1]!.replace(',', '.')) : null
    if (score === null) {
      score = inferMuc4ScoreFromHours(row.authors)
    }
    if (score === null) return null
    const code = new Map<number, string>([
      [0.25, 'QD_R14_P025'],
      [0.5, 'QD_R14_P050'],
      [0.75, 'QD_R14_P075'],
      [1, 'QD_R14_P100'],
      [1.25, 'QD_R14_P125'],
    ]).get(score)
    if (!code) return null
    return {
      code,
      section: 4,
      rank: 'DOMESTIC',
      quartile: null,
      publicationType: 'JOURNAL',
      domesticRuleType: 'HDGSNN_SCORE',
      hdgsnnScore: score,
    }
  }

  // Mục 5 QĐ 1883: một mức cố định (QD_R15). Excel cũ tách 5.1–5.5 vẫn thuộc mục 5.
  if (type.includes('bbmuc5')) {
    return {
      code: 'QD_R15',
      section: 5,
      rank: 'OTHER',
      quartile: null,
      publicationType: 'CONFERENCE',
      domesticRuleType: 'CONFERENCE_ISBN',
      hdgsnnScore: null,
    }
  }

  return null
}

/** 4.2 không ghi điểm trong nhãn → suy điểm HĐGS từ Giờ NCKH (B0 = điểm × 600). */
function inferMuc4ScoreFromHours(authors: LegacyAuthorRow[]): number | null {
  const scores = [0.25, 0.5, 0.75, 1, 1.25] as const
  const hours = authors.map((a) => a.gioNckh).filter((h): h is number => h !== null)
  if (!hours.length) return null

  const p = authors.length
  const n =
    authors.filter((a) => isTopAuthor(a.tenVaiTro) || isCorresponding(a.tenVaiTro)).length || 1

  for (const score of scores) {
    const totalHours = score * 600
    let valid = true
    for (const author of authors) {
      if (author.gioNckh === null) {
        valid = false
        break
      }
      const isMain = isTopAuthor(author.tenVaiTro) || isCorresponding(author.tenVaiTro)
      const expected = isMain
        ? totalHours / (3 * n) + (2 * totalHours) / (3 * p)
        : (2 * totalHours) / (3 * p)
      if (modifierFor(author.gioNckh, expected) === null) {
        valid = false
        break
      }
    }
    if (valid) return score
  }

  // Fallback: bài 1 tác giả — giờ ≈ B0 hoặc B0×1.2
  if (hours.length === 1) {
    const h = hours[0]!
    for (const score of scores) {
      const b0 = score * 600
      if (Math.abs(h - b0) <= 1 || Math.abs(h - b0 * 1.2) <= 1) return score
    }
  }

  return 0.5
}

function modifierFor(actual: number, expected: number): number | null {
  if (expected <= 0) return null
  const ratio = actual / expected
  let best: { modifier: number; error: number } | null = null
  for (const modifier of MODIFIERS) {
    const error = Math.abs(ratio - modifier)
    if (!best || error < best.error) best = { modifier, error }
  }
  return best && best.error <= 0.02 ? best.modifier : null
}

function inferAAndModifiers(
  authors: PreparedAuthor[],
  baseHours: number,
  section: 1 | 2 | 3
): InferenceResult | null {
  if (!authors.length || authors.some((author) => author.gioNckh === null)) return null
  const p = authors.length
  const n = authors.filter((author) => author.isTopAuthor || author.isCorresponding).length
  if (n < 1) return null
  const actualTotalHours = authors.reduce((total, author) => total + author.gioNckh!, 0)

  const candidates = section === 3 ? ([1, 2] as const) : ([1, 1.5, 2] as const)
  const matches: InferenceResult[] = []

  for (const a of candidates) {
    const totalHours = baseHours * a
    const modifiers: number[] = []
    const expectedHours: number[] = []
    let valid = true
    for (const author of authors) {
      const isMain = author.isTopAuthor || author.isCorresponding
      const expected = isMain
        ? totalHours / (3 * n) + (2 * totalHours) / (3 * p)
        : (2 * totalHours) / (3 * p)
      const modifier = modifierFor(author.gioNckh!, expected)
      if (modifier === null) {
        valid = false
        break
      }
      modifiers.push(modifier)
      expectedHours.push(expected * modifier)
    }
    if (!valid) continue
    const expectedTotalHours = expectedHours.reduce((total, hours) => total + hours, 0)
    const totalTolerance = Math.max(0.1, actualTotalHours * 0.0001)
    if (Math.abs(actualTotalHours - expectedTotalHours) > totalTolerance) continue

    const scope =
      section === 3
        ? authors.map((_, index) => index)
        : (() => {
            const correspondingIndexes = authors
              .map((author, index) => (author.isCorresponding ? index : -1))
              .filter((index) => index >= 0)
            return correspondingIndexes.length
              ? correspondingIndexes
              : authors
                  .map((author, index) => (author.isTopAuthor ? index : -1))
                  .filter((index) => index >= 0)
          })()
    if (a === 2 && scope.some((index) => modifiers[index] === 0.5 || modifiers[index] === 0.6)) {
      continue
    }
    matches.push({ a, modifiers })
  }

  return matches.length === 1 ? matches[0]! : null
}

function unitsWithOther(units: UdnAffiliationUnitKey[]): UdnAffiliationUnitKey[] {
  const udnUnits = units.filter((unit) => unit !== 'OTHER')
  const baseUnits: UdnAffiliationUnitKey[] = udnUnits.length ? udnUnits : ['UDN']
  return [...new Set<UdnAffiliationUnitKey>([...baseUnits, 'OTHER'])]
}

function applyInferredAffiliations(
  authors: PreparedAuthor[],
  section: 1 | 2 | 3,
  inference: InferenceResult
) {
  authors.forEach((author, index) => {
    const modifier = inference.modifiers[index]!
    author.modifier = modifier
    author.genderInferred = modifier === 1.2 || modifier === 0.6 ? 'FEMALE' : 'MALE'
    if (modifier === 0.5 || modifier === 0.6) {
      author.affiliationType = 'MIXED'
      author.affiliationUnits = unitsWithOther(author.affiliationUnits)
      author.isMultiAffiliationOutsideUdn = true
    }
  })

  if (section === 1 || section === 2) {
    for (const author of authors.filter((item) => item.isCorresponding)) {
      if (inference.a === 2) {
        author.affiliationType = 'UDN_ONLY'
        author.affiliationUnits = author.affiliationUnits.filter((unit) => unit !== 'OTHER')
        if (!author.affiliationUnits.length) author.affiliationUnits = ['UDN']
        author.isMultiAffiliationOutsideUdn = false
      } else if (inference.a === 1.5) {
        author.affiliationType = 'MIXED'
        author.affiliationUnits = unitsWithOther(author.affiliationUnits)
        author.isMultiAffiliationOutsideUdn = true
      } else {
        author.affiliationType = 'OUTSIDE'
        author.affiliationUnits = ['OTHER']
        author.isMultiAffiliationOutsideUdn = false
      }
    }
  } else if (inference.a === 2) {
    for (const author of authors) {
      author.affiliationType = 'UDN_ONLY'
      author.affiliationUnits = author.affiliationUnits.filter((unit) => unit !== 'OTHER')
      if (!author.affiliationUnits.length) author.affiliationUnits = ['UDN']
      author.isMultiAffiliationOutsideUdn = false
    }
  }
}

export default class LegacyPublicationExcelImportService {
  static async run(options: ImportOptions): Promise<LegacyPublicationImportSummary> {
    const workbook = XLSX.readFile(path.resolve(options.file))
    const sheetName = options.sheet || workbook.SheetNames[0]
    const sheet = sheetName ? workbook.Sheets[sheetName] : null
    if (!sheet || !sheetName) throw new Error(`Không tìm thấy sheet ${sheetName || '(đầu tiên)'}.`)

    const rows = parseCombinedSheet(sheet)
    const summary: LegacyPublicationImportSummary = {
      totalPublications: rows.length,
      createdPublications: 0,
      updatedPublications: 0,
      existingPublications: 0,
      skippedPublications: 0,
      createdAuthors: 0,
      mappedDepartments: 0,
      unresolvedDepartments: 0,
      inferredGender: { male: 0, female: 0, unresolved: 0 },
      inferredA: { a1: 0, a15: 0, a2: 0, unresolved: 0 },
      warnings: [],
      errors: [],
    }

    const types = await ResearchOutputType.query().preload('rule')
    const typeByCode = new Map(types.map((type) => [type.code.toUpperCase(), type]))

    const departments = await Department.query().where('status', 'ACTIVE')
    const departmentByName = new Map<string, Department>()
    for (const department of departments) {
      for (const value of [department.name, department.shortName, department.code]) {
        const key = normalizeDepartmentName(value)
        if (key && !departmentByName.has(key)) departmentByName.set(key, department)
      }
    }
    const warnedDepartmentNames = new Set<string>()

    const profiles = await ScientificProfile.query().select(
      'id',
      'user_id',
      'full_name',
      'department_id'
    )
    const profileByUserId = new Map<number, ScientificProfile>()
    const profilesByName = new Map<string, ScientificProfile[]>()
    for (const profile of profiles) {
      if (profile.userId) profileByUserId.set(Number(profile.userId), profile)
      const key = normalizeLoose(profile.fullName)
      profilesByName.set(key, [...(profilesByName.get(key) ?? []), profile])
    }

    const staffs = await Staff.query().select('staff_code', 'user_id', 'gender', 'department_id')
    const staffByCode = new Map(staffs.map((staff) => [normalizeLoose(staff.staffCode), staff]))

    const students = await Student.query().select('id', 'student_code', 'gender', 'department_id')
    const studentByCode = new Map(
      students.map((student) => [normalizeLoose(student.studentCode), student])
    )

    for (const row of rows) {
      const mapping = mapType(row)
      if (!mapping) {
        summary.skippedPublications++
        summary.warnings.push(
          `[${row.maBaiBao}] Chưa có loại kết quả phù hợp: ${row.tenLoaiPhanCap}`
        )
        continue
      }
      const outputType = typeByCode.get(mapping.code)
      if (!outputType) {
        summary.skippedPublications++
        summary.errors.push(`[${row.maBaiBao}] Không tìm thấy danh mục ${mapping.code}.`)
        continue
      }
      if (!row.tenBaiBao || !row.authors.length) {
        summary.skippedPublications++
        summary.errors.push(`[${row.maBaiBao}] Thiếu tên bài hoặc danh sách tác giả.`)
        continue
      }
      if (row.tongThanhVien !== null && row.tongThanhVien !== row.authors.length) {
        summary.warnings.push(
          `[${row.maBaiBao}] Tổng thành viên=${row.tongThanhVien}, đọc được ${row.authors.length} tác giả.`
        )
      }

      const preparedAuthors: PreparedAuthor[] = row.authors.map((author) => {
        const department = author.tenDonVi
          ? departmentByName.get(normalizeDepartmentName(author.tenDonVi))
          : undefined
        if (author.tenDonVi) {
          if (department) summary.mappedDepartments++
          else {
            summary.unresolvedDepartments++
            const departmentKey = normalizeDepartmentName(author.tenDonVi)
            if (!warnedDepartmentNames.has(departmentKey)) {
              warnedDepartmentNames.add(departmentKey)
              summary.warnings.push(`Không map được đơn vị "${author.tenDonVi}".`)
            }
          }
        }

        const code = normalizeLoose(author.maCanBo)
        const staff = code ? staffByCode.get(code) : undefined
        const student = code ? studentByCode.get(code) : undefined
        const profile = staff?.userId ? profileByUserId.get(Number(staff.userId)) : undefined
        const nameProfiles = profilesByName.get(normalizeLoose(author.hoTenCanBo)) ?? []
        const profileByUniqueName =
          !profile && nameProfiles.length === 1 && department?.id === nameProfiles[0]!.departmentId
            ? nameProfiles[0]
            : undefined

        const identity: Identity = {
          profileId: profile?.id ?? profileByUniqueName?.id ?? null,
          studentId: student?.id ?? null,
          departmentId:
            department?.id ??
            staff?.departmentId ??
            student?.departmentId ??
            profile?.departmentId ??
            profileByUniqueName?.departmentId ??
            null,
          gender: normalizeGender(staff?.gender ?? student?.gender),
        }
        const internal = Boolean(
          identity.profileId || identity.studentId || identity.departmentId || department
        )

        return {
          ...author,
          ...identity,
          isTopAuthor: isTopAuthor(author.tenVaiTro),
          isCorresponding: isCorresponding(author.tenVaiTro),
          departmentMatchedFromExcel: Boolean(department),
          genderInferred: null,
          modifier: null,
          affiliationType: internal ? 'UDN_ONLY' : 'OUTSIDE',
          affiliationUnits: internal ? ['UDN_USE'] : ['OTHER'],
          isMultiAffiliationOutsideUdn: false,
        }
      })

      if (mapping.section <= 3) {
        const baseHours = Number(outputType.rule?.hoursValue ?? 0)
        const inference =
          baseHours > 0
            ? inferAAndModifiers(preparedAuthors, baseHours, mapping.section as 1 | 2 | 3)
            : null
        if (inference) {
          if (inference.a === 1) summary.inferredA.a1++
          else if (inference.a === 1.5) summary.inferredA.a15++
          else summary.inferredA.a2++
          applyInferredAffiliations(preparedAuthors, mapping.section as 1 | 2 | 3, inference)
          if (
            mapping.section <= 2 &&
            inference.a > 1 &&
            !preparedAuthors.some((author) => author.isCorresponding)
          ) {
            summary.warnings.push(
              `[${row.maBaiBao}] Suy được a=${inference.a} nhưng Excel không đánh dấu tác giả liên hệ; không tự chọn người thay thế.`
            )
          }
        } else {
          summary.inferredA.unresolved++
          summary.warnings.push(`[${row.maBaiBao}] Không suy được duy nhất hệ số a từ Giờ NCKH.`)
        }
      }

      for (const author of preparedAuthors) {
        if (author.gender && author.genderInferred && author.gender !== author.genderInferred) {
          summary.warnings.push(
            `[${row.maBaiBao}] Giới tính hồ sơ của ${author.hoTenCanBo} không khớp giờ suy diễn.`
          )
        }
        // Ưu tiên: giờ NCKH → hồ sơ CB/SV → tên có "thị" = nữ; còn lại mặc định nam
        const finalGender =
          author.genderInferred ?? author.gender ?? inferGenderFromFullName(author.hoTenCanBo)
        author.gender = finalGender
        if (finalGender === 'MALE') summary.inferredGender.male++
        else if (finalGender === 'FEMALE') summary.inferredGender.female++
        else summary.inferredGender.unresolved++
      }

      // Cán bộ kê khai = chủ bản ghi KQNC (publications.profile_id) khi người dùng đăng nhập tạo mới
      const declarerName = normalizeLoose(row.canBoKeKhai)
      const declarerAuthor = preparedAuthors.find(
        (author) => normalizeLoose(author.hoTenCanBo) === declarerName && author.profileId
      )
      const uniqueDeclarerProfiles = profilesByName.get(declarerName) ?? []
      const ownerProfileId =
        declarerAuthor?.profileId ??
        (uniqueDeclarerProfiles.length === 1 ? uniqueDeclarerProfiles[0]!.id : null)
      if (!ownerProfileId) {
        summary.warnings.push(
          `[${row.maBaiBao}] Không xác định được hồ sơ người kê khai "${row.canBoKeKhai}".`
        )
      }

      const sourceId = `${SOURCE_ID_PREFIX}${row.maBaiBao}`
      const existing = await Publication.query()
        .where('source', SOURCE)
        .where('source_id', sourceId)
      if (existing.length > 1) {
        summary.skippedPublications++
        summary.errors.push(
          `[${row.maBaiBao}] Có ${existing.length} bản ghi trùng source_id; cần hợp nhất trước.`
        )
        continue
      }
      if (existing.length === 1 && !options.updateExisting) {
        summary.existingPublications++
        continue
      }

      const publishedAt = row.ngayDang
        ? DateTime.fromISO(row.ngayDang, { zone: 'local' }).startOf('day')
        : null
      if (publishedAt?.isValid && row.namXuatBan && publishedAt.year !== row.namXuatBan) {
        summary.warnings.push(
          `[${row.maBaiBao}] Năm XB ${row.namXuatBan} khác ngày đăng ${row.ngayDang}; giữ nguyên cả hai giá trị.`
        )
      }
      const correspondingNames = preparedAuthors
        .filter((author) => author.isCorresponding)
        .map((author) => author.hoTenCanBo)
      const ownerAuthor = preparedAuthors.find((author) => author.profileId === ownerProfileId)
      const payload = {
        profileId: ownerProfileId,
        researchOutputTypeId: outputType.id,
        title: row.tenBaiBao,
        authors: preparedAuthors.map((author) => author.hoTenCanBo).join(', '),
        correspondingAuthor: correspondingNames.join(', ') || null,
        myRole:
          ownerAuthor && (ownerAuthor.isTopAuthor || ownerAuthor.isCorresponding)
            ? 'CHU_TRI'
            : 'DONG_TAC_GIA',
        publicationType: mapping.publicationType,
        journalOrConference: row.tenTapChi || 'Không rõ nguồn công bố',
        publisher: row.nhaXuatBan || null,
        year: row.namXuatBan,
        publishedAt: publishedAt?.isValid ? publishedAt : null,
        issue: row.issue || null,
        pages: row.pages || null,
        url: row.url || null,
        rank: mapping.rank,
        quartile: mapping.quartile,
        domesticRuleType: mapping.domesticRuleType,
        hdgsnnScore: mapping.hdgsnnScore,
        publicationStatus: 'PUBLISHED',
        reviewStatus: normalizeLoose(row.trangThai) === 'da duyet' ? 'APPROVED' : 'NEW',
        correctionReason: row.yeuCauHieuChinh || null,
        source: SOURCE,
        sourceId,
        needsIndexConfirmation: false,
        indexMappedCode: mapping.code,
        indexMappingReason: `Import từ ${path.basename(options.file)} / ${sheetName}`,
        verifiedByNcv: false,
        approvedInternal: null,
      }

      if (options.dryRun) {
        if (existing.length) summary.updatedPublications++
        else summary.createdPublications++
        summary.createdAuthors += preparedAuthors.length
        continue
      }

      try {
        await db.transaction(async (trx) => {
          let publication = existing[0]
          if (publication) {
            publication.useTransaction(trx)
            publication.merge(payload)
            await publication.save()
            await PublicationAuthor.query({ client: trx })
              .where('publication_id', publication.id)
              .delete()
            summary.updatedPublications++
          } else {
            publication = await Publication.create(payload, { client: trx })
            summary.createdPublications++
          }

          for (const [index, author] of preparedAuthors.entries()) {
            await PublicationAuthor.create(
              {
                publicationId: publication.id,
                profileId: author.profileId,
                studentId: author.studentId,
                departmentId: author.departmentId,
                gender: author.gender,
                fullName: author.hoTenCanBo,
                authorOrder: index + 1,
                isTopAuthor: author.isTopAuthor,
                isCorresponding: author.isCorresponding,
                affiliationType: author.affiliationType,
                affiliationUnits: author.affiliationUnits,
                isMultiAffiliationOutsideUdn: author.isMultiAffiliationOutsideUdn,
                contributionPercent: null,
              },
              { client: trx }
            )
          }
          summary.createdAuthors += preparedAuthors.length
        })
      } catch (error) {
        summary.errors.push(
          `[${row.maBaiBao}] ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    return summary
  }
}
