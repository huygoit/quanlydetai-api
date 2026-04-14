import * as fs from 'node:fs'
import * as path from 'node:path'
import XLSX from 'xlsx'
import db from '@adonisjs/lucid/services/db'

export interface StaffImportError {
  rowNumber: number
  staffCode: string
  fullName: string
  reason: string
  sourceRow: Record<string, unknown>
}

export interface StaffImportResult {
  total: number
  inserted: number
  updated: number
  skipped: number
  failed: number
  errors: StaffImportError[]
  warnings: string[]
}

function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/** Chuẩn hoá ngày từ Excel/chuỗi: serial, Date, yyyy-mm-dd, dd/mm/yyyy (VN). */
function formatLocalYmd(d: Date): string | null {
  const y = d.getFullYear()
  if (y < 1900 || y > 2100) return null
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseExcelDate(val: unknown): string | null {
  if (val === null || val === undefined) return null

  // Ô ngày kiểu Date (một số pipeline Excel trả về trực tiếp)
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return formatLocalYmd(val)
  }

  const s = String(val ?? '').trim()
  if (!s || s.startsWith('--') || s === '#VALUE!' || s === '#ERROR!') return null

  // Số thuần: serial Excel (vd: 45321) — không dùng cho số dạng mã khác
  if (typeof val === 'number' && !Number.isNaN(val)) {
    if (val > 20000 && val < 70000) {
      const utc = Math.round((val - 25569) * 86400 * 1000)
      const d = new Date(utc)
      const y = d.getUTCFullYear()
      if (y >= 1900 && y <= 2100) {
        return `${y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
  }

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

  const normalized = s.replace(/-/g, '/')
  const parts = normalized.split('/').map((p) => p.trim())
  if (parts.length >= 3) {
    const a = parseInt(parts[0], 10)
    const b = parseInt(parts[1], 10)
    const c = parseInt(parts[2], 10)
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) {
      // bỏ qua, thử Date.parse
    } else {
      // yyyy/mm/dd hoặc yyyy-mm-dd (năm ở đầu)
      if (a >= 1900 && a <= 2100 && b >= 1 && b <= 12 && c >= 1 && c <= 31) {
        const d = new Date(a, b - 1, c)
        if (d.getFullYear() === a && d.getMonth() === b - 1 && d.getDate() === c) {
          return `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`
        }
      }

      // dd/mm/yyyy: năm thường ở cuối (sheet VN)
      if (c >= 1900 && c <= 2100) {
        let day: number
        let month: number
        const year = c
        if (a > 12) {
          day = a
          month = b
        } else if (b > 12) {
          day = b
          month = a
        } else {
          // Cả hai ≤ 12: mặc định dd/mm (Việt Nam)
          day = a
          month = b
        }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const d = new Date(year, month - 1, day)
          if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          }
        }
      }
    }
  }

  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return formatLocalYmd(d)
  }
  return null
}

function parseBool01(val: unknown): boolean | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim().toLowerCase()
  if (!s) return null
  if (s === '1' || s === 'true' || s === 'yes' || s === 'co' || s === 'có') return true
  if (s === '0' || s === 'false' || s === 'no' || s === 'khong' || s === 'không') return false
  return null
}

function parseNumber(val: unknown): number | null {
  const s = String(val ?? '').trim().replace(/,/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function normalizeGender(raw: string): string | null {
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

/**
 * Hệ số lương (nv_hsluong): số thập phân nhỏ (vd 4,65).
 * Nếu gặp số ~20k–70k thì thường là serial ngày Excel do ô sai định dạng — bỏ qua để tránh overflow DECIMAL.
 */
function parseSalaryCoefficient(val: unknown): number | null {
  const s = String(val ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  if (Number.isNaN(n)) return null
  if (n > 20000 && n < 70000) return null
  if (n < 0 || n > 9999) return null
  return Math.round(n * 100) / 100
}

/** Năm (tốt nghiệp, công nhận…): chỉ chấp nhận 1900–2100 để tránh nhầm mã số vào cột integer. */
function parseYearInt(val: unknown): number | null {
  const n = parseNumber(val)
  if (n === null) return null
  const y = Math.trunc(n)
  if (y < 1900 || y > 2100) return null
  return y
}

async function writeErrorLog(errors: StaffImportError[], runId: string): Promise<string> {
  const dir = path.join(process.cwd(), 'storage', 'import-logs')
  await fs.promises.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `staff-import-errors-${runId}.json`)
  await fs.promises.writeFile(filePath, JSON.stringify(errors, null, 2), 'utf-8')
  return filePath
}

async function writeRunLog(payload: Record<string, unknown>, runId: string): Promise<string> {
  const dir = path.join(process.cwd(), 'storage', 'import-logs')
  await fs.promises.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `staff-import-${runId}.json`)
  await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return filePath
}

async function resolveDepartmentId(departmentCode: string, departmentName: string): Promise<number | null> {
  if (departmentCode) {
    const byCode = await db.from('departments').select('id').whereRaw('LOWER(code) = ?', [departmentCode.toLowerCase()]).first()
    if (byCode?.id) return Number(byCode.id)
  }
  if (departmentName) {
    const byName = await db.from('departments').select('id').whereRaw('LOWER(name) = ?', [departmentName.toLowerCase()]).first()
    if (byName?.id) return Number(byName.id)
  }
  return null
}

export default class StaffImportService {
  static readonly DEFAULT_FILE = 'prompts/KH_CNTT_2025_2026.xlsx'
  static readonly DEFAULT_SHEET = 'DMNHanSu'

  static getFilePath(customPath?: string): string {
    const p = customPath || this.DEFAULT_FILE
    return path.isAbsolute(p) ? p : path.join(process.cwd(), p)
  }

  static async runImport(options: {
    file?: string
    sheet?: string
    dryRun?: boolean
    verbose?: boolean
  }): Promise<StaffImportResult & { errorLogPath?: string; logPath?: string }> {
    const resolvedPath = this.getFilePath(options.file)
    const sheetName = options.sheet || this.DEFAULT_SHEET
    const result: StaffImportResult & { errorLogPath?: string; logPath?: string } = {
      total: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      warnings: [],
    }

    if (!fs.existsSync(resolvedPath)) {
      result.errors.push({ rowNumber: 0, staffCode: '', fullName: '', reason: `File không tồn tại: ${resolvedPath}`, sourceRow: {} })
      result.failed = 1
      return result
    }

    const workbook = XLSX.readFile(resolvedPath, { type: 'file' })
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      result.errors.push({
        rowNumber: 0,
        staffCode: '',
        fullName: '',
        reason: `Sheet "${sheetName}" không tồn tại. Danh sách sheet: ${workbook.SheetNames.join(', ')}`,
        sourceRow: {},
      })
      result.failed = 1
      return result
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    result.total = rows.length
    if (rows.length === 0) return result

    const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2
      const row = rows[i]

      const staffCode = getCell(row, 'nv_id')
      const fullName = getCell(row, 'nv_hoten')
      if (!staffCode || !fullName) {
        result.skipped++
        result.errors.push({
          rowNumber,
          staffCode,
          fullName,
          reason: `Thiếu ${!staffCode ? 'nv_id' : 'nv_hoten'}`,
          sourceRow: { ...row },
        })
        continue
      }

      try {
        const departmentName = getCell(row, 'donvi_name')
        const departmentCode = getCell(row, 'donvi_ma')
        const departmentId = await resolveDepartmentId(departmentCode, departmentName)
        if (!departmentId && (departmentCode || departmentName)) {
          result.warnings.push(`[dòng ${rowNumber}] không map được department: ${departmentCode || departmentName}`)
        }

        const payload = {
          staff_code: staffCode,
          full_name: fullName,

          date_of_birth: parseExcelDate(getCell(row, 'nv_ngaysinh')),
          gender: normalizeGender(getCell(row, 'nv_gioitinh')),
          marital_status: getCell(row, 'nv_honnhan') || null,
          religion_or_ethnicity: getCell(row, 'nv_tongiao') || null,
          priority_group: getCell(row, 'nv_uutienGD') || null,

          identity_number: getCell(row, 'nv_soCCCD') || null,
          identity_issue_place: getCell(row, 'nv_noicap') || null,
          identity_issue_date: parseExcelDate(getCell(row, 'nv_ngaycap')),
          insurance_number: getCell(row, 'nv_soBHXH') || null,

          hometown: getCell(row, 'nv_quequan') || null,
          place_of_birth: getCell(row, 'nv_noisinh') || null,
          permanent_address: getCell(row, 'nv_thuongtru') || null,
          current_address: getCell(row, 'nv_noiohiennay') || null,

          phone: getCell(row, 'nv_sdt') || null,
          email: getCell(row, 'nv_email') || null,

          department_name: departmentName || null,
          department_code: departmentCode || null,
          department_id: departmentId,

          hired_at: parseExcelDate(getCell(row, 'nv_ngaytuyendung')),
          ranked_at: parseExcelDate(getCell(row, 'nv_ngaybanngach')),
          receiving_agency: getCell(row, 'nv_coquantiepnhan') || null,
          recruitment_work_type: getCell(row, 'nv_viec_tuyendung') || null,
          staff_type: getCell(row, 'nv_loaicanbo') || null,
          current_job: getCell(row, 'nv_viec_hiennay') || null,
          social_insurance_leave: getCell(row, 'nv_nghiBHXH') || null,

          position_title: getCell(row, 'nv_chucvu') || null,
          appointed_at: parseExcelDate(getCell(row, 'nv_ngaybonhiem')),
          concurrent_position: getCell(row, 'nv_chucvu_coquankiemnhiem') || null,
          highest_position: getCell(row, 'nv_chucvu_coquancao nhat') || null,
          party_joined_at_raw: getCell(row, 'nv_ngayvaodang') || null,
          party_position: getCell(row, 'nv_chucvudang') || null,
          is_union_member: parseBool01(getCell(row, 'nv_doanvien')),

          professional_degree: getCell(row, 'nv_chuyenmon') || null,
          industry_group: getCell(row, 'nv_khoinganh') || null,
          field: getCell(row, 'nv_linhvuc') || null,
          major: getCell(row, 'nv_chuyennganh') || null,
          professional_title: getCell(row, 'nv_chức danh') || null,

          training_place: getCell(row, 'nv_noidaotao') || null,
          training_mode: getCell(row, 'nv_hinhthucdaotao_id') || null,
          training_country: getCell(row, 'nv_quocgiadaotao') || null,
          training_institution: getCell(row, 'nv_cosodaotao') || null,
          graduation_year: parseYearInt(getCell(row, 'nv_namtotnghiep')),

          political_level: getCell(row, 'nv_trinhdochinhtri') || null,
          state_management_level: getCell(row, 'nv_trinhdoqlnn') || null,
          it_level: getCell(row, 'nv_trinhdotinhoc') || null,
          title_award: getCell(row, 'nv_danhhieu') || null,
          recognition_year: parseYearInt(getCell(row, 'nv_namcongnhan')),
          academic_title: getCell(row, 'nv_hocham') || null,
          is_85_program: parseBool01(getCell(row, 'nv_huong85')),
          job_title_type: getCell(row, 'nv_loaichucdanh') || null,

          salary_step: parseNumber(getCell(row, 'nv_batluong')),
          salary_coefficient: parseSalaryCoefficient(getCell(row, 'nv_hsluong')),

          note: null,
          source_data: row,
          updated_at: new Date(),
        } as Record<string, unknown>

        const existed = await db.from('staffs').select('id').where('staff_code', staffCode).first()
        if (existed?.id) {
          if (!options.dryRun) {
            await db.from('staffs').where('id', existed.id).update(payload)
          }
          result.updated++
        } else {
          payload.created_at = new Date()
          if (!options.dryRun) {
            await db.table('staffs').insert(payload)
          }
          result.inserted++
        }
      } catch (e) {
        result.failed++
        result.errors.push({
          rowNumber,
          staffCode,
          fullName,
          reason: (e as Error).message,
          sourceRow: { ...row },
        })
      }
    }

    if (result.errors.length > 0) {
      result.errorLogPath = await writeErrorLog(result.errors, runId)
    }

    if (result.warnings.length > 0 || result.errors.length > 0) {
      result.logPath = await writeRunLog(
        {
          file: options.file || this.DEFAULT_FILE,
          sheet: sheetName,
          dryRun: !!options.dryRun,
          summary: {
            total: result.total,
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            failed: result.failed,
            warnings: result.warnings.length,
            errors: result.errors.length,
          },
          warnings: result.warnings,
          errors: result.errors,
        },
        runId
      )
    }

    if (options.verbose) {
      for (const w of result.warnings) {
        // eslint-disable-next-line no-console
        console.warn(w)
      }
    }

    return result
  }
}

