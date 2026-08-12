import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import * as fs from 'node:fs'
import * as path from 'node:path'
import StaffPositionSyncService from '#services/staff_position_sync_service'

/**
 * Đồng bộ chức vụ staffs từ Excel sheet "Bảng Nhân Viên", khớp theo email.
 * Lưu chuỗi ID catalog: position_title (POSITION) + party_position (PARTY).
 *
 * Mặc định dry-run. Thêm --apply mới ghi DB.
 *
 * Local:
 *   node ace sync:staff-positions --file="C:\quanlydetai\tailieu\final\final\DanhMucDonVi_CHUAN_moii.xlsx"
 *   node ace sync:staff-positions --file="..." --apply
 */
export default class SyncStaffPositions extends BaseCommand {
  static commandName = 'sync:staff-positions'
  static description = 'Đồng bộ chức vụ staffs (chuỗi ID POSITION/PARTY) từ Excel theo email'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description:
      'Đường dẫn Excel (mặc định: commands/DanhMucDonVi_CHUAN_moii.xlsx)',
  })
  declare file?: string

  @flags.string({
    flagName: 'sheet',
    description: 'Tên sheet (mặc định: Bảng Nhân Viên)',
  })
  declare sheet?: string

  @flags.boolean({
    flagName: 'apply',
    description: 'Ghi DB (mặc định chỉ dry-run / báo cáo)',
  })
  declare apply: boolean

  async run() {
    if (this.apply) {
      this.logger.warning('Chế độ APPLY: ghi position_title + party_position trên staffs')
    } else {
      this.logger.info('Chế độ DRY-RUN: không ghi DB (thêm --apply để cập nhật)')
    }

    const report = await StaffPositionSyncService.run({
      file: this.file,
      sheet: this.sheet,
      apply: this.apply,
    })

    this.logger.info(`Nguồn: ${report.sourceFile}`)
    this.logger.info(`Sheet: "${report.sourceSheet}"`)
    this.logger.info(`Dòng Excel có email: ${report.excelWithEmail}`)
    this.logger.info(`Khớp trong DB: ${report.matchedInDb}`)
    this.logger.warning(`Thiếu trong DB: ${report.missingInDb}`)
    this.logger.warning(`Cần cập nhật: ${report.needFix}`)
    this.logger.info(`Không đổi: ${report.unchanged}`)
    if (report.duplicateEmails.length > 0) {
      this.logger.warning(`Email trùng trong Excel: ${report.duplicateEmails.length}`)
    }
    if (report.unmatchedNames.length > 0) {
      this.logger.warning(`Tên Excel không khớp catalog (${report.unmatchedNames.length}):`)
      for (const n of report.unmatchedNames.slice(0, 40)) this.logger.warning(`  - ${n}`)
    }

    if (report.applied) {
      this.logger.success(`Đã cập nhật staffs: ${report.staffUpdated}`)
    }

    for (const item of report.items.slice(0, 40)) {
      this.logger.info(
        `\n[${item.staffCode || '-'}] ${item.email} (${item.matchedBy}) — ${item.fullName || ''}`
      )
      for (const field of item.changedFields) {
        const key = field as keyof typeof item.before
        this.logger.warning(
          `  - ${field}: "${item.before[key] || ''}" → "${item.after[key] || ''}"`
        )
      }
    }
    if (report.items.length > 40) {
      this.logger.warning(`... còn ${report.items.length - 40} dòng chưa in`)
    }

    if (report.missingEmails.length > 0) {
      this.logger.warning(
        `Email Excel không khớp staff: ${report.missingEmails.slice(0, 20).join(', ')}${
          report.missingEmails.length > 20 ? ' ...' : ''
        }`
      )
    }

    const outDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outPath = path.join(
      outDir,
      `sync-staff-positions-${report.applied ? 'applied' : 'dry-run'}-${stamp}.json`
    )
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
    this.logger.success(`Đã ghi báo cáo: ${outPath}`)

    if (report.needFix > 0 && !report.applied) {
      this.logger.info('Review báo cáo rồi chạy lại kèm --apply để ghi DB.')
    }
  }
}
