import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import StaffImportService from '#services/staff_import_service'

export default class ImportStaffs extends BaseCommand {
  static commandName = 'import:staffs'
  static description = 'Import danh mục nhân sự từ Excel (sheet DMNHanSu) vào bảng staffs'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn file .xlsx/.csv (mặc định: prompts/KH_CNTT_2025_2026.xlsx)',
  })
  declare file?: string

  @flags.string({
    flagName: 'sheet',
    description: 'Tên sheet Excel (mặc định: DMNHanSu)',
  })
  declare sheet?: string

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Chỉ parse, không ghi DB',
  })
  declare dryRun: boolean

  @flags.boolean({
    flagName: 'verbose',
    description: 'In chi tiết warnings',
  })
  declare verbose: boolean

  async run() {
    const result = await StaffImportService.runImport({
      file: this.file,
      sheet: this.sheet,
      dryRun: this.dryRun,
      verbose: this.verbose,
    })

    this.logger.info(`Tổng dòng: ${result.total}`)
    this.logger.success(`Thêm mới: ${result.inserted}`)
    this.logger.success(`Cập nhật: ${result.updated}`)
    this.logger.info(`Bỏ qua: ${result.skipped}`)
    this.logger.warning(`Warnings: ${result.warnings.length}`)
    this.logger.warning(`Lỗi: ${result.failed}`)

    if (this.verbose) {
      for (const w of result.warnings) this.logger.warning(w)
    }
    for (const err of result.errors) {
      this.logger.error(`  [dòng ${err.rowNumber}] ${err.reason} (nv_id=${err.staffCode})`)
    }

    const logPath = (result as { logPath?: string }).logPath
    if (logPath) this.logger.warning(`Log import (warnings + errors): ${logPath}`)
    if (result.errorLogPath) this.logger.warning(`Chi tiết lỗi (file): ${result.errorLogPath}`)
    if (result.failed > 0) this.exitCode = 1
  }
}

