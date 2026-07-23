import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import * as fs from 'node:fs'
import * as path from 'node:path'
import StaffNameGenderFixService from '#services/staff_name_gender_fix_service'

/**
 * Tìm / sửa lệch họ tên + giới tính do import nhầm sheet DMNHanSu.
 * Nguồn chuẩn mặc định: commands/DanhMucDonVi_CHUAN_moii.xlsx → sheet "Bảng Nhân Viên".
 *
 * Mặc định dry-run. Thêm --apply mới ghi DB.
 * Chỉ sửa staffs + scientific_profiles (đủ để KPI ×1.2 đúng).
 */
export default class FixStaffNameGenderFromHr extends BaseCommand {
  static commandName = 'fix:staff-name-gender-from-hr'
  static description =
    'Đối chiếu Bảng Nhân Viên để tìm/sửa lệch họ tên + giới tính (staffs, scientific_profiles)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn Excel nguồn chuẩn (mặc định: commands/DanhMucDonVi_CHUAN_moii.xlsx)',
  })
  declare file?: string

  @flags.string({
    flagName: 'sheet',
    description: 'Tên sheet chuẩn (mặc định: Bảng Nhân Viên)',
  })
  declare sheet?: string

  @flags.boolean({
    flagName: 'apply',
    description: 'Ghi DB (mặc định chỉ dry-run / báo cáo)',
  })
  declare apply: boolean

  @flags.boolean({
    flagName: 'fix-personal',
    description: 'Đồng thời sửa personal_profiles theo Excel',
  })
  declare fixPersonal: boolean

  @flags.boolean({
    flagName: 'fix-users',
    description: 'Đồng thời sửa users.full_name theo Excel',
  })
  declare fixUsers: boolean

  async run() {
    if (this.apply) {
      this.logger.warning('Chế độ APPLY: sẽ ghi staffs + scientific_profiles')
      if (this.fixPersonal) this.logger.warning('Đã bật --fix-personal')
      if (this.fixUsers) this.logger.warning('Đã bật --fix-users')
    } else {
      this.logger.info('Chế độ DRY-RUN: không ghi DB (thêm --apply để sửa)')
    }

    const report = await StaffNameGenderFixService.run({
      file: this.file,
      sheet: this.sheet,
      apply: this.apply,
      fixPersonal: this.fixPersonal,
      fixUsers: this.fixUsers,
    })

    this.logger.info(`Nguồn: ${report.sourceFile} | sheet="${report.sourceSheet}"`)
    this.logger.info(`Dòng Excel hợp lệ: ${report.excelRows}`)
    this.logger.info(`Khớp mã NV trong DB: ${report.matchedInDb}`)
    this.logger.warning(`Thiếu trong DB: ${report.missingInDb}`)
    this.logger.warning(`Cần sửa (staff/sci): ${report.needFix}`)
    this.logger.info(`Khớp / chỉ báo cáo: ${report.unchanged}`)

    if (report.applied) {
      this.logger.success(`Đã cập nhật staffs: ${report.staffUpdated}`)
      this.logger.success(`Đã cập nhật scientific_profiles: ${report.sciUpdated}`)
      if (this.fixPersonal) {
        this.logger.success(`Đã cập nhật personal_profiles: ${report.personalUpdated}`)
      }
      if (this.fixUsers) {
        this.logger.success(`Đã cập nhật users: ${report.userUpdated}`)
      }
    }

    const show = report.items.filter((i) =>
      i.actions.some((a) => !a.startsWith('CHỈ BÁO CÁO'))
    )
    for (const item of show.slice(0, 80)) {
      this.logger.info(
        `\n[${item.staffCode}] ${item.email}\n  Excel: ${item.excelFullName} / ${item.excelGender || '-'}`
      )
      for (const a of item.actions) this.logger.warning(`  - ${a}`)
    }
    if (show.length > 80) {
      this.logger.warning(`... còn ${show.length - 80} dòng chưa in`)
    }

    const outDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outPath = path.join(
      outDir,
      `fix-staff-name-gender-${report.applied ? 'applied' : 'dry-run'}-${stamp}.json`
    )
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
    this.logger.success(`Đã ghi báo cáo: ${outPath}`)

    if (report.needFix > 0 && !report.applied) {
      this.logger.info('Chạy lại kèm --apply khi đã review báo cáo.')
    }
  }
}
