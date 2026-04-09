import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ResearchOutputTypesImportService from '#services/research_output_types_import_service'

/**
 * Import cây "Loại kết quả NCKH" (3 cấp) + rule từ Excel quy đổi giờ.
 * File mẫu: prompts/quy_doi_gio_NCKH.xlsx — sheet Bang1_QuyDoi.
 */
export default class ImportResearchOutputTypes extends BaseCommand {
  static commandName = 'import:research-output-types'
  static description =
    'Import loại kết quả NCKH (3 cấp) + rule từ Excel QĐ quy đổi giờ (sheet Bang1_QuyDoi)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn .xlsx (mặc định: prompts/quy_doi_gio_NCKH.xlsx)',
  })
  declare file?: string

  @flags.string({
    flagName: 'sheet',
    description: 'Tên sheet (mặc định: Bang1_QuyDoi)',
  })
  declare sheet?: string

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Chỉ đọc + validate, không ghi DB',
  })
  declare dryRun: boolean

  @flags.boolean({
    flagName: 'truncate',
    description:
      'TRUNCATE toàn bộ research_output_types + research_output_rules trước khi import (xóa cây cũ)',
  })
  declare truncate: boolean

  @flags.boolean({
    flagName: 'yes',
    alias: 'y',
    description: 'Bắt buộc kèm --truncate để xác nhận xóa dữ liệu cũ (không hỏi tương tác)',
  })
  declare yes: boolean

  async run() {
    if (this.truncate && !this.dryRun && !this.yes) {
      this.logger.error('Khi dùng --truncate cần thêm --yes để xác nhận xóa toàn bộ cây loại NCKH.')
      this.exitCode = 1
      return
    }

    const result = await ResearchOutputTypesImportService.runImport({
      file: this.file,
      sheet: this.sheet,
      dryRun: this.dryRun,
      truncate: this.truncate,
    })

    this.logger.info(`Dòng đọc được: ${result.total}`)
    this.logger.success(`Tạo type (ước lượng/lần ghi): ${result.typesCreated}`)
    this.logger.info(`Bỏ qua (đã có mã lá): ${result.typesSkipped}`)
    this.logger.success(`Tạo rule: ${result.rulesCreated}`)
    this.logger.warning(`Lỗi: ${result.failed}`)

    for (const e of result.errors) {
      this.logger.error(`  [dòng ${e.rowNumber}] ${e.reason}`)
    }

    if (result.logPath) {
      this.logger.info(`Log: ${result.logPath}`)
    }

    if (result.failed > 0) {
      this.exitCode = 1
    }
  }
}
