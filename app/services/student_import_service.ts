import * as fs from 'node:fs'
import * as path from 'node:path'
import { DateTime } from 'luxon'
import XLSX from 'xlsx'
import Student from '#models/student'
import Department from '#models/department'

/** Lỗi khi import 1 dòng */
export interface StudentImportError {
  rowNumber: number
  studentCode: string
  fullName: string
  reason: string
  sourceRow: Record<string, unknown>
}

/** Kết quả import */
export interface StudentImportResult {
  total: number
  inserted: number
  updated: number
  skipped: number
  failed: number
  errors: StudentImportError[]
}

/** Map cột Excel (có thể có khoảng trắng khác) */
function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/** Chuẩn hóa giới tính: Nam -> male, Nữ -> female */
function normalizeGender(val: string): string | null {
  const v = val.trim().toLowerCase()
  if (v === 'nam') return 'male'
  if (v === 'nữ' || v === 'nu') return 'female'
  if (v) return 'other'
  return null
}

/** Parse ngày: 24/07/2004, 19-04-2021; lỗi như --1968 -> null */
function normalizeDate(val: string): string | null {
  const s = String(val).trim()
  if (!s || s.startsWith('--') || s === '#VALUE!' || s === '#ERROR!') return null

  // Excel serial date (vd: 45231)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s)
    if (!Number.isNaN(serial) && serial > 20000 && serial < 70000) {
      const utc = Math.round((serial - 25569) * 86400 * 1000)
      const d = new Date(utc)
      const y = d.getUTCFullYear()
      if (y >= 1900 && y <= 2100) {
        return `${y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
    return null
  }

  const d = s.replace(/-/g, '/').split('/')
  if (d.length >= 3) {
    const day = parseInt(d[0], 10)
    const month = parseInt(d[1], 10) - 1
    const year = parseInt(d[2], 10)
    if (!Number.isNaN(year) && year > 1900 && year < 2100) {
      const date = new Date(year, month, day)
      if (!Number.isNaN(date.getTime())) return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear()
    if (y >= 1900 && y <= 2100) return parsed.toISOString().slice(0, 10)
  }
  return null
}

/** Tách major_name từ Mã chuyên ngành: "31101-Sư phạm Toán học" -> "Sư phạm Toán học" */
function extractMajorName(majorCodeRaw: string): string {
  const idx = majorCodeRaw.indexOf('-')
  if (idx >= 0) return majorCodeRaw.slice(idx + 1).trim()
  return majorCodeRaw.trim()
}

/**
 * Đọc Excel, build map DonVi_Nganh: nganh (trim) -> don_vi_ma_chuan.
 * Sheet DonVi_Nganh có cột tên ngành và mã đơn vị chuẩn (tên cột có thể là "nganh"/"don_vi_ma_chuan" hoặc tiếng Việt).
 */
function buildDonViNganhMap(workbook: XLSX.WorkBook): Map<string, string> {
  const map = new Map<string, string>()
  const sheetNames = workbook.SheetNames.filter((n) => n === 'DonVi_Nganh' || n.toLowerCase().includes('donvi'))
  if (sheetNames.length === 0) return map
  const sheet = workbook.Sheets[sheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  for (const row of rows) {
    const nganh = getCell(row, 'nganh', 'Nganh', 'Ngành', 'Tên ngành').trim()
    const code = getCell(row, 'don_vi_ma_chuan', 'don vi ma chuan', 'Mã đơn vị chuẩn', 'Đơn vị mã chuẩn').trim()
    if (nganh && code) map.set(nganh, code)
  }
  return map
}

/**
 * Resolve department_id từ major_name: DonVi_Nganh.nganh -> don_vi_ma_chuan -> departments.code
 */
async function resolveDepartmentId(
  majorName: string,
  donViNganhMap: Map<string, string>
): Promise<number | null> {
  const normalized = majorName.trim()
  if (!normalized) return null
  const code = donViNganhMap.get(normalized)
  if (!code) return null
  const dept = await Department.query().where('code', code).first()
  return dept ? dept.id : null
}

/**
 * Parse 1 dòng Excel SinhVien thành payload cho Student (không ghi DB).
 */
async function parseRow(
  row: Record<string, unknown>,
  rowNumber: number,
  donViNganhMap: Map<string, string>
): Promise<{ payload: Partial<InstanceType<typeof Student>>; error: StudentImportError | null }> {
  const studentCode = getCell(row, 'Mã sinh viên', 'Ma sinh vien')
  if (!studentCode) {
    return {
      payload: {},
      error: {
        rowNumber,
        studentCode: '',
        fullName: getCell(row, 'Full Name', 'Họ lót sinh viên') + ' ' + getCell(row, 'Tên sinh viên'),
        reason: 'Thiếu mã sinh viên',
        sourceRow: { ...row },
      },
    }
  }

  const fullName =
    getCell(row, 'Full Name') ||
    [getCell(row, 'Họ lót sinh viên'), getCell(row, 'Tên sinh viên')].filter(Boolean).join(' ').trim() ||
    ''
  const majorCodeRaw = getCell(row, 'Mã chuyên ngành')
  const majorName = majorCodeRaw ? extractMajorName(majorCodeRaw) : ''
  const departmentId = majorName ? await resolveDepartmentId(majorName, donViNganhMap) : null

  const dateOfBirth = normalizeDate(getCell(row, 'Ngày sinh'))
  const identityIssueDate = normalizeDate(getCell(row, 'Ngày cấp CCCD'))

  const payload: Partial<InstanceType<typeof Student>> = {
    studentCode,
    firstName: getCell(row, 'Họ lót sinh viên') || null,
    lastName: getCell(row, 'Tên sinh viên') || null,
    fullName: fullName || null,
    gender: normalizeGender(getCell(row, 'Giới tính')),
    dateOfBirth: dateOfBirth ? DateTime.fromISO(dateOfBirth) : null,
    placeOfBirth: getCell(row, 'Nơi sinh') || null,
    classCode: getCell(row, 'Mã lớp') || null,
    className: getCell(row, 'Ghi chú tên lớp') || null,
    courseName: getCell(row, 'Tên khóa học') || null,
    status: getCell(row, 'Tình trạng') || null,
    majorCodeRaw: majorCodeRaw || null,
    majorName: majorName || null,
    departmentId,
    personalEmail: getCell(row, 'Email cá nhân') || null,
    schoolEmail: getCell(row, 'Email Trương', 'Email Truong') || null,
    phone: getCell(row, 'Điện thoại cá nhân', 'Dien thoai ca nhan') || null,
    identityCardNumber: getCell(row, 'Số CCCD', 'So CCCD') || null,
    identityCardIssuePlace: getCell(row, 'Nơi cấp CCCD', 'Noi cap CCCD') || null,
    identityCardIssueDate: identityIssueDate ? DateTime.fromISO(identityIssueDate) : null,
    ethnicity: getCell(row, 'Dân tộc', 'Dan toc') || null,
    permanentAddress: getCell(row, 'Địa chỉ hộ khẩu 1', 'Dia chi ho khau 1') || null,
    contactAddress: getCell(row, 'Địa chỉ liên lạc 1', 'Dia chi lien lac 1') || null,
    temporaryAddress: getCell(row, 'Địa chỉ tạm trú 1', 'Dia chi tam tru 1') || null,
    note: getCell(row, 'Ghi chú') || null,
    sourceData: row as Record<string, unknown>,
  }

  return { payload, error: null }
}

/** Ghi log lỗi ra file trong storage/import-logs */
async function writeErrorLog(errors: StudentImportError[], runId: string): Promise<string> {
  const dir = path.join(process.cwd(), 'storage', 'import-logs')
  await fs.promises.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `student-import-errors-${runId}.json`)
  await fs.promises.writeFile(filePath, JSON.stringify(errors, null, 2), 'utf-8')
  return filePath
}

/**
 * Chạy import từ file Excel.
 * File mặc định: prompts/data-for-kpi04-05.xlsx (tính từ root project).
 */
export default class StudentImportService {
  static readonly DEFAULT_FILE = 'prompts/data-for-kpi04-05.xlsx'

  static getFilePath(customPath?: string): string {
    if (customPath) return path.isAbsolute(customPath) ? customPath : path.join(process.cwd(), customPath)
    return path.join(process.cwd(), this.DEFAULT_FILE)
  }

  static async runImport(filePath?: string): Promise<StudentImportResult> {
    const resolvedPath = this.getFilePath(filePath)
    const result: StudentImportResult = { total: 0, inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] }

    if (!fs.existsSync(resolvedPath)) {
      result.errors.push({
        rowNumber: 0,
        studentCode: '',
        fullName: '',
        reason: `File không tồn tại: ${resolvedPath}`,
        sourceRow: {},
      })
      result.failed = 1
      return result
    }

    const workbook = XLSX.readFile(resolvedPath, { type: 'file' })
    const donViNganhMap = buildDonViNganhMap(workbook)

    const normalizeSheetName = (n: string) => n.toLowerCase().replace(/\s/g, '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
    const sheetNames = workbook.SheetNames.filter(
      (n) => n === 'SinhVien' || normalizeSheetName(n).includes('sinhvien')
    )
    if (sheetNames.length === 0) {
      result.errors.push({
        rowNumber: 0,
        studentCode: '',
        fullName: '',
        reason: `Không tìm thấy sheet SinhVien trong file Excel. Các sheet có sẵn: ${workbook.SheetNames.join(', ')}`,
        sourceRow: {},
      })
      result.failed = 1
      return result
    }

    const sheet = workbook.Sheets[sheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    result.total = rows.length

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2
      const row = rows[i]
      const { payload, error } = await parseRow(row, rowNumber, donViNganhMap)

      if (error) {
        result.errors.push(error)
        result.failed++
        continue
      }

      if (!payload.studentCode) {
        result.skipped++
        continue
      }

      try {
        const existing = await Student.query().where('student_code', payload.studentCode).first()
        if (existing) {
          existing.merge(payload as Record<string, unknown>)
          await existing.save()
          result.updated++
        } else {
          await Student.create(payload as Record<string, unknown>)
          result.inserted++
        }
      } catch (e) {
        result.errors.push({
          rowNumber,
          studentCode: payload.studentCode ?? '',
          fullName: (payload.fullName as string) ?? '',
          reason: (e as Error).message,
          sourceRow: row as Record<string, unknown>,
        })
        result.failed++
      }
    }

    if (result.errors.length > 0) {
      const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const logPath = await writeErrorLog(result.errors, runId)
      ;(result as Record<string, unknown>).errorLogPath = logPath
    }

    return result
  }
}
