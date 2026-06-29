import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import XLSX from 'xlsx'
import ScientificProfile from '#models/scientific_profile'
import Field from '#models/field'
import Specialization from '#models/specialization'
import {
  resolveScientificProfileDegreeKey,
  resolveScientificProfileAcademicTitleKey,
} from '#constants/scientific_profile_catalog'

/**
 * Cập nhật học hàm / học vị / cơ sở đào tạo / lĩnh vực nghiên cứu / chuyên ngành
 * cho hồ sơ khoa học từ file Excel danh mục nhân sự (sheet "Bảng Nhân Viên").
 *
 * Khóa mapping: email (nv_email ↔ scientific_profiles.work_email).
 * Cột nguồn:
 *  - nv_hocham      → academicTitle (học hàm: GS/PGS; rỗng → NONE)
 *  - nv_chuyenmon   → degree (học vị: Tiến sỹ/Thạc sỹ/Đại học/THPT…)
 *  - nv_noidaotao   → degreeInstitution (cơ sở đào tạo)
 *  - nv_linhvuc     → mainResearchArea (lĩnh vực nghiên cứu)
 *  - nv_chuyennganh → specialization (chuyên ngành)
 */
export default class ImportStaffProfileAcademic extends BaseCommand {
  static commandName = 'import:staff-profile-academic'
  static description =
    'Cập nhật học hàm/học vị/cơ sở đào tạo/lĩnh vực/chuyên ngành cho hồ sơ khoa học từ Excel (map theo email)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn file .xlsx',
  })
  declare file?: string

  @flags.string({ flagName: 'sheet', description: 'Tên sheet (mặc định: Bảng Nhân Viên)' })
  declare sheet?: string

  @flags.boolean({ flagName: 'dry-run', description: 'Chỉ báo cáo, không ghi DB' })
  declare dryRun: boolean

  @flags.boolean({ flagName: 'verbose', description: 'In chi tiết từng dòng cập nhật/cảnh báo' })
  declare verbose: boolean

  /** Bỏ dấu + lowercase để so khớp nhãn học vị đặc thù (THPT…). */
  private chuanHoa(input: string): string {
    return input
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'd')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim()
  }

  /** Map học vị từ nhãn Excel sang key catalog (xử lý thêm THPT). */
  private mapDegree(raw: string): string | null {
    const key = resolveScientificProfileDegreeKey(raw)
    if (key) return key
    const norm = this.chuanHoa(raw)
    if (norm === 'thpt' || norm.includes('trung hoc pho thong')) return 'HIGH_SCHOOL'
    return null
  }

  private chuoiSach(v: unknown): string | null {
    if (v == null) return null
    const s = String(v).trim()
    return s.length ? s : null
  }

  /** Chuẩn hóa để so khớp danh mục: bỏ dấu, gộp khoảng trắng, hạ chữ, gập y→i. */
  private chuanHoaKhop(input: string): string {
    return this.chuanHoa(input).replace(/y/g, 'i')
  }

  /** Sinh code danh mục từ tên (A-Z0-9 + gạch dưới). */
  private toSlugCode(name: string): string {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return base.slice(0, 60) || 'CN'
  }

  async run() {
    const filePath = this.file ?? 'C:/quanlydetai/tailieu/final/final/DanhMucDonVi_CHUAN_moii.xlsx'
    const sheetName = this.sheet ?? 'Bảng Nhân Viên'

    const wb = XLSX.readFile(filePath, { type: 'file' })
    const ws = wb.Sheets[sheetName]
    if (!ws) {
      this.logger.error(`Không tìm thấy sheet "${sheetName}" trong file ${filePath}`)
      this.exitCode = 1
      return
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

    // Nạp danh mục lĩnh vực / chuyên ngành để map text → id (theo tên đã chuẩn hóa).
    const fields = await Field.all()
    const specs = await Specialization.all()
    const fieldMap = new Map<string, number>()
    for (const f of fields) fieldMap.set(this.chuanHoaKhop(f.name), f.id)
    const specMap = new Map<string, number>()
    for (const s of specs) specMap.set(this.chuanHoaKhop(s.name), s.id)

    let matched = 0
    let updated = 0
    let noEmail = 0
    let notFound = 0
    let fieldUnmatched = 0
    let specCreated = 0
    const degreeWarnings: string[] = []
    const updateLogs: string[] = []

    for (const row of rows) {
      const email = this.chuoiSach(row.nv_email)
      if (!email || !email.includes('@')) {
        noEmail++
        continue
      }

      const profile = await ScientificProfile.query()
        .whereRaw('LOWER(work_email) = ?', [email.toLowerCase()])
        .first()
      if (!profile) {
        notFound++
        if (this.verbose) this.logger.warning(`  Không có hồ sơ KH cho email: ${email}`)
        continue
      }
      matched++

      const changes: Record<string, unknown> = {}

      // Học hàm: Excel là nguồn chuẩn → rỗng nghĩa là không có học hàm (NONE).
      const hochamRaw = this.chuoiSach(row.nv_hocham)
      const academicTitle = hochamRaw ? resolveScientificProfileAcademicTitleKey(hochamRaw) : 'NONE'
      if (academicTitle && profile.academicTitle !== academicTitle) {
        changes.academicTitle = academicTitle
        if (academicTitle === 'NONE') changes.academicTitleYear = null
      } else if (hochamRaw && !academicTitle) {
        degreeWarnings.push(`[${email}] Không map được học hàm: "${hochamRaw}"`)
      }

      // Học vị
      const chuyenmonRaw = this.chuoiSach(row.nv_chuyenmon)
      if (chuyenmonRaw) {
        const degreeKey = this.mapDegree(chuyenmonRaw)
        if (degreeKey) {
          if (profile.degree !== degreeKey) changes.degree = degreeKey
        } else {
          degreeWarnings.push(`[${email}] Không map được học vị: "${chuyenmonRaw}"`)
        }
      }

      // Cơ sở đào tạo / lĩnh vực / chuyên ngành — chỉ cập nhật khi Excel có giá trị.
      const noidaotao = this.chuoiSach(row.nv_noidaotao)
      if (noidaotao && profile.degreeInstitution !== noidaotao) changes.degreeInstitution = noidaotao

      const linhvuc = this.chuoiSach(row.nv_linhvuc)
      if (linhvuc) {
        if (profile.mainResearchArea !== linhvuc) changes.mainResearchArea = linhvuc
        const fid = fieldMap.get(this.chuanHoaKhop(linhvuc)) ?? null
        if (fid == null) {
          fieldUnmatched++
          degreeWarnings.push(`[${email}] Không khớp lĩnh vực trong danh mục: "${linhvuc}"`)
        } else if (profile.researchFieldId !== fid) {
          changes.researchFieldId = fid
        }
      }

      const chuyennganh = this.chuoiSach(row.nv_chuyennganh)
      if (chuyennganh) {
        if (profile.specialization !== chuyennganh) changes.specialization = chuyennganh
        const key = this.chuanHoaKhop(chuyennganh)
        let sid = specMap.get(key) ?? null
        if (sid == null && !this.dryRun) {
          // Tự bổ sung chuyên ngành thiếu vào danh mục rồi dùng id mới.
          const baseCode = this.toSlugCode(chuyennganh)
          let code = baseCode
          let n = 2
          while (specs.some((s) => s.code === code)) code = `${baseCode}_${n++}`.slice(0, 80)
          const created = await Specialization.create({
            code,
            name: chuyennganh,
            displayOrder: (specs.length + 1) * 10,
            status: 'ACTIVE',
          })
          specs.push(created)
          specMap.set(key, created.id)
          sid = created.id
          specCreated++
          if (this.verbose) this.logger.info(`  + Thêm chuyên ngành danh mục: "${chuyennganh}" (#${created.id})`)
        }
        if (sid != null && profile.specializationId !== sid) changes.specializationId = sid
      }

      if (Object.keys(changes).length === 0) continue

      updated++
      if (this.verbose) {
        updateLogs.push(`  [${email}] ${JSON.stringify(changes)}`)
      }

      if (!this.dryRun) {
        profile.merge(changes)
        await profile.save()
      }
    }

    this.logger.info(`File: ${filePath} — sheet "${sheetName}"`)
    this.logger.info(`Tổng dòng: ${rows.length}`)
    this.logger.info(`Dòng thiếu email: ${noEmail}`)
    this.logger.warning(`Email không tìm thấy hồ sơ KH: ${notFound}`)
    this.logger.success(`Khớp hồ sơ: ${matched}`)
    this.logger.success(`${this.dryRun ? 'Sẽ cập nhật' : 'Đã cập nhật'}: ${updated}`)
    this.logger.warning(`Lĩnh vực không khớp danh mục: ${fieldUnmatched}`)
    this.logger.success(`Chuyên ngành tự bổ sung danh mục: ${specCreated}`)
    this.logger.warning(`Cảnh báo map học hàm/học vị: ${degreeWarnings.length}`)

    if (this.verbose) {
      for (const l of updateLogs) this.logger.info(l)
    }
    for (const w of degreeWarnings.slice(0, 50)) this.logger.warning(`  ${w}`)
  }
}
