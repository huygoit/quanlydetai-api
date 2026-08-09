import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import XLSX from 'xlsx'
import Staff from '#models/staff'
import User from '#models/user'
import ScientificProfile from '#models/scientific_profile'
import IamUserService from '#services/iam_user_service'
import {
  resolveScientificProfileDegreeKey,
  resolveScientificProfileAcademicTitleKey,
  type ScientificProfileAcademicTitleKey,
  type ScientificProfileDegreeKey,
} from '#constants/scientific_profile_catalog'

type ExcelRow = {
  fullName: string
  chucVuOrChucDanh: string | null
  hocHamHocViRaw: string | null
  googleScholarUrl: string | null
  khoa: string | null
  linhVuc: string | null
  chuyenMon: string | null
  scvUrl: string | null
  errorNote: string | null
  email: string
}

/**
 * Sửa danh sách GV lỗi từ file giao-vien-loi.xlsx:
 * - Tạo tài khoản nếu chưa có (user=email, mật khẩu mặc định 123456789)
 * - Gắn staff.user_id theo email
 * - Cập nhật Google Scholar / học hàm / học vị trên hồ sơ khoa học (+ staff nếu có)
 *
 * Chạy:
 *   node ace fix:giao-vien-loi --dry-run
 *   node ace fix:giao-vien-loi
 *   node ace fix:giao-vien-loi --reset-password   # đặt lại MK cho user đã có trong list
 */
export default class FixGiaoVienLoi extends BaseCommand {
  static commandName = 'fix:giao-vien-loi'
  static description =
    'Tạo tài khoản + cập nhật Scholar/học hàm/học vị từ file giao-vien-loi.xlsx'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn file .xlsx',
  })
  declare file?: string

  @flags.boolean({ flagName: 'dry-run', description: 'Chỉ báo cáo, không ghi DB' })
  declare dryRun: boolean

  @flags.boolean({
    flagName: 'reset-password',
    description: 'Đặt lại mật khẩu 123456789 cho user đã tồn tại trong list',
  })
  declare resetPassword: boolean

  @flags.boolean({ flagName: 'verbose', description: 'In chi tiết từng dòng' })
  declare verbose: boolean

  private chuoiSach(v: unknown): string | null {
    if (v == null) return null
    const s = String(v).replace(/\u00a0/g, ' ').trim()
    return s.length ? s : null
  }

  private chuanHoaTen(input: string): string {
    return input
      .normalize('NFC')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  /** Tách "PGS.TS" / "GS.TS" / "TS" / "Tiến sĩ" → học hàm + học vị. */
  private tachHocHamHocVi(raw: string | null): {
    academicTitle: ScientificProfileAcademicTitleKey | null
    degree: ScientificProfileDegreeKey | null
  } {
    if (!raw) return { academicTitle: null, degree: null }
    const cleaned = raw.replace(/\s+/g, ' ').trim()
    const norm = cleaned
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '')

    let academicTitle: ScientificProfileAcademicTitleKey | null = null
    let degree: ScientificProfileDegreeKey | null = null

    if (norm.includes('pgs') || norm.includes('phogiaosu')) {
      academicTitle = 'ASSOCIATE_PROFESSOR'
    } else if (
      (norm.includes('gs') || norm.includes('giaosu')) &&
      !norm.includes('pgs') &&
      !norm.includes('pho')
    ) {
      academicTitle = 'PROFESSOR'
    } else {
      academicTitle = resolveScientificProfileAcademicTitleKey(cleaned)
    }

    if (norm === 'ts' || /(^|[.])ts$/.test(norm) || norm.includes('tiensi') || norm.includes('tiensy')) {
      degree = 'DOCTORATE'
    } else if (norm.includes('thacsi') || norm.includes('thacsy') || norm === 'ths') {
      degree = 'MASTER'
    } else {
      degree = resolveScientificProfileDegreeKey(cleaned)
      // "PGS.TS" đôi khi catalog không map — fallback tách phần sau dấu chấm
      if (!degree && cleaned.includes('.')) {
        const parts = cleaned.split(/[./]/).map((p) => p.trim()).filter(Boolean)
        for (const p of parts) {
          const d = resolveScientificProfileDegreeKey(p)
          if (d) {
            degree = d
            break
          }
          const pn = p
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .replace(/\u0111/g, 'd')
            .toLowerCase()
          if (pn === 'ts') degree = 'DOCTORATE'
          if (pn === 'ths') degree = 'MASTER'
        }
      }
    }

    return { academicTitle, degree }
  }

  private docExcel(filePath: string): ExcelRow[] {
    const wb = XLSX.readFile(filePath, { type: 'file' })
    const sheetName = wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    // File không có header chuẩn cột C/D → đọc theo chỉ số cột
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1,
      defval: null,
      raw: false,
    })

    const rows: ExcelRow[] = []
    for (let i = 1; i < matrix.length; i++) {
      const r = matrix[i] || []
      const email = this.chuoiSach(r[9])
      const fullName = this.chuoiSach(r[0])
      if (!email || !email.includes('@') || !fullName) continue
      rows.push({
        fullName,
        chucVuOrChucDanh: this.chuoiSach(r[1]),
        hocHamHocViRaw: this.chuoiSach(r[2]),
        googleScholarUrl: this.chuoiSach(r[3]),
        khoa: this.chuoiSach(r[4]),
        linhVuc: this.chuoiSach(r[5]),
        chuyenMon: this.chuoiSach(r[6]),
        scvUrl: this.chuoiSach(r[7]),
        errorNote: this.chuoiSach(r[8]),
        email: email.toLowerCase(),
      })
    }
    return rows
  }

  private async timStaff(row: ExcelRow): Promise<Staff | null> {
    const byEmail = await Staff.query().whereRaw('LOWER(email) = ?', [row.email]).first()
    if (byEmail) return byEmail

    // Khớp đúng họ tên (tránh cập nhật nhầm khi trùng tên)
    const candidates = await Staff.query().whereILike('full_name', row.fullName)
    const exact = candidates.filter(
      (s) => this.chuanHoaTen(s.fullName || '') === this.chuanHoaTen(row.fullName)
    )
    if (exact.length === 1) return exact[0]
    if (exact.length > 1) {
      this.logger.warning(
        `  [${row.email}] Trùng họ tên "${row.fullName}" (${exact.length} staff) — bỏ qua gắn staff, chỉ xử lý user/hồ sơ theo email.`
      )
    }
    return null
  }

  async run() {
    const filePath = this.file || 'C:/quanlydetai/tailieu/giao-vien-loi.xlsx'
    const defaultPassword = '123456789'
    const rows = this.docExcel(filePath)

    this.logger.info(`File: ${filePath}`)
    this.logger.info(`Số dòng hợp lệ: ${rows.length}${this.dryRun ? ' (dry-run)' : ''}`)

    let userCreated = 0
    let userExisted = 0
    let passwordReset = 0
    let staffLinked = 0
    let staffEmailUpdated = 0
    let staffNotFound = 0
    let profileCreated = 0
    let profileUpdated = 0
    let profileUnchanged = 0

    for (const row of rows) {
      const { academicTitle, degree } = this.tachHocHamHocVi(row.hocHamHocViRaw)
      if (this.verbose) {
        this.logger.info(
          `— ${row.fullName} | ${row.email} | raw=${row.hocHamHocViRaw || '—'} → title=${academicTitle || '—'} degree=${degree || '—'} | lỗi: ${row.errorNote || '—'}`
        )
      }

      // 1) User
      let user = await User.query().whereRaw('LOWER(email) = ?', [row.email]).first()
      if (!user) {
        if (!this.dryRun) {
          user = await IamUserService.create({
            fullName: row.fullName,
            email: row.email,
            password: defaultPassword,
            isActive: true,
            note: `Tạo từ fix:giao-vien-loi (${row.errorNote || 'giao-vien-loi.xlsx'})`,
          })
        }
        userCreated++
        if (this.verbose) this.logger.success(`  + Tạo user ${row.email}`)
      } else {
        userExisted++
        if (!this.dryRun) {
          let dirty = false
          if (!user.isActive) {
            user.isActive = true
            dirty = true
          }
          if (!(user.fullName || '').trim()) {
            user.fullName = row.fullName
            dirty = true
          }
          if (this.resetPassword) {
            user.password = defaultPassword
            dirty = true
            passwordReset++
          }
          if (dirty) await user.save()
        } else if (this.resetPassword) {
          passwordReset++
        }
      }

      // 2) Staff
      const staff = await this.timStaff(row)
      if (!staff) {
        staffNotFound++
        if (this.verbose) this.logger.warning(`  ! Không tìm thấy staff cho ${row.fullName}`)
      } else if (user) {
        let staffDirty = false
        const staffEmail = (staff.email || '').trim().toLowerCase()
        if (staffEmail !== row.email) {
          staff.email = row.email
          staffEmailUpdated++
          staffDirty = true
          if (this.verbose) this.logger.info(`  ~ Staff #${staff.id} đổi email → ${row.email}`)
        }
        if (Number(staff.userId) !== Number(user.id)) {
          const other = await Staff.query()
            .where('user_id', user.id)
            .whereNot('id', staff.id)
            .first()
          if (other) {
            this.logger.warning(
              `  ! User ${row.email} đã gắn staff #${other.id} (${other.fullName}) — không đổi staff #${staff.id}`
            )
          } else {
            staff.userId = user.id
            staffLinked++
            staffDirty = true
            if (this.verbose) this.logger.info(`  ~ Staff #${staff.id} gắn user_id=${user.id}`)
          }
        }
        if (academicTitle && academicTitle !== 'NONE') {
          const label = academicTitle === 'PROFESSOR' ? 'GS' : 'PGS'
          if ((staff.academicTitle || '').trim() !== label) {
            staff.academicTitle = label
            staffDirty = true
          }
        }
        if (degree) {
          const degreeLabel =
            degree === 'DOCTORATE' ? 'Tiến sĩ' : degree === 'MASTER' ? 'Thạc sĩ' : null
          if (degreeLabel && (staff.professionalDegree || '').trim() !== degreeLabel) {
            staff.professionalDegree = degreeLabel
            staffDirty = true
          }
        }
        if (row.chucVuOrChucDanh && !(staff.positionTitle || '').trim()) {
          staff.positionTitle = row.chucVuOrChucDanh
          staffDirty = true
        }
        if (staffDirty && !this.dryRun) await staff.save()
      } else if (this.dryRun && staff) {
        // User sẽ tạo mới — dry-run vẫn báo sẽ gắn staff
        if (!staff.userId) staffLinked++
        const staffEmail = (staff.email || '').trim().toLowerCase()
        if (staffEmail !== row.email) staffEmailUpdated++
        if (this.verbose) {
          this.logger.info(`  ~ (dry-run) Sẽ gắn staff #${staff.id} với user mới ${row.email}`)
        }
      }

      // 3) Hồ sơ khoa học — Scholar + học hàm + học vị
      let profile: ScientificProfile | null = null
      if (user) {
        profile = await ScientificProfile.query().where('user_id', user.id).first()
        if (!profile) {
          profile = await ScientificProfile.query()
            .whereRaw('LOWER(work_email) = ?', [row.email])
            .first()
        }
      } else {
        profile = await ScientificProfile.query()
          .whereRaw('LOWER(work_email) = ?', [row.email])
          .first()
      }

      const changes: Record<string, unknown> = {}
      if (!profile) {
        profileCreated++
        if (this.verbose) this.logger.success(`  + Tạo hồ sơ KH ${row.email}`)
        if (!this.dryRun && user) {
          await ScientificProfile.create({
            userId: user.id,
            fullName: row.fullName,
            workEmail: row.email,
            organization: 'Trường Đại học Sư phạm - Đại học Đà Nẵng',
            faculty: row.khoa,
            department: row.khoa,
            currentTitle: row.chucVuOrChucDanh,
            googleScholarUrl: row.googleScholarUrl,
            personalWebsite: row.scvUrl,
            mainResearchArea: row.linhVuc,
            specialization: row.chuyenMon,
            degree: degree,
            academicTitle: academicTitle ?? 'NONE',
          })
        }
        continue
      }

      if (row.googleScholarUrl && profile.googleScholarUrl !== row.googleScholarUrl) {
        changes.googleScholarUrl = row.googleScholarUrl
      }
      if (degree && profile.degree !== degree) changes.degree = degree
      if (academicTitle && profile.academicTitle !== academicTitle) {
        changes.academicTitle = academicTitle
      }
      if (row.scvUrl && !profile.personalWebsite) changes.personalWebsite = row.scvUrl
      if (row.linhVuc && !profile.mainResearchArea) changes.mainResearchArea = row.linhVuc
      if (row.chuyenMon && !profile.specialization) changes.specialization = row.chuyenMon
      if (row.khoa && !profile.faculty) changes.faculty = row.khoa
      if (row.chucVuOrChucDanh && !profile.currentTitle) {
        changes.currentTitle = row.chucVuOrChucDanh
      }
      if ((profile.workEmail || '').trim().toLowerCase() !== row.email) {
        changes.workEmail = row.email
      }
      if (user && Number(profile.userId) !== Number(user.id)) {
        const occupied = await ScientificProfile.query().where('user_id', user.id).first()
        if (!occupied) changes.userId = user.id
      }

      if (Object.keys(changes).length === 0) {
        profileUnchanged++
        continue
      }
      if (!this.dryRun) {
        profile.merge(changes)
        await profile.save()
      }
      profileUpdated++
      if (this.verbose) this.logger.success(`  ~ Cập nhật hồ sơ: ${JSON.stringify(changes)}`)
    }

    this.logger.info('—— Kết quả ——')
    this.logger.success(`User tạo mới: ${userCreated}`)
    this.logger.info(`User đã có: ${userExisted}`)
    this.logger.info(`Reset mật khẩu: ${passwordReset}`)
    this.logger.success(`Staff gắn user_id: ${staffLinked}`)
    this.logger.info(`Staff cập nhật email đúng: ${staffEmailUpdated}`)
    this.logger.warning(`Không tìm thấy staff: ${staffNotFound}`)
    this.logger.success(`Hồ sơ KH tạo mới: ${profileCreated}`)
    this.logger.success(`Hồ sơ KH cập nhật: ${profileUpdated}`)
    this.logger.info(`Hồ sơ KH không đổi: ${profileUnchanged}`)
    this.logger.info(
      'Ghi chú: lĩnh vực/chuyên môn/ảnh/bio để GV tự cập nhật trên hồ sơ nếu còn thiếu.'
    )
  }
}
