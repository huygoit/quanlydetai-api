import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import JournalIndexImportService from '#services/journal_index_import_service'

export default class ImportJournalIndexEntries extends BaseCommand {
  static commandName = 'import:journal-index'
  static description = 'Import bảng chỉ mục tạp chí theo năm từ Excel/CSV'
  static options: CommandOptions = { startApp: true }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn file Excel/CSV',
  })
  declare file: string

  @flags.string({
    flagName: 'sheet',
    alias: 's',
    description: 'Tên sheet (nếu là Excel)',
  })
  declare sheet?: string

  @flags.string({
    flagName: 'provider',
    description: 'Tên nguồn dữ liệu (WOS/SCIMAGO/...)',
  })
  declare provider?: string

  @flags.number({
    flagName: 'year',
    alias: 'y',
    description: 'Năm áp dụng khi file không có cột year (ví dụ SCImago 2025)',
  })
  declare year?: number

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Chỉ kiểm tra, không ghi DB',
  })
  declare dryRun: boolean

  async run() {
    if (!this.file) {
      this.logger.error('Thiếu --file')
      this.exitCode = 1
      return
    }
    const result = await JournalIndexImportService.run({
      file: this.file,
      sheet: this.sheet,
      sourceProvider: this.provider,
      year: this.year,
      dryRun: this.dryRun,
    })

    this.logger.info(`Tổng dòng: ${result.total}`)
    this.logger.success(`Thêm mới: ${result.inserted}`)
    this.logger.info(`Cập nhật: ${result.updated}`)
    this.logger.warning(`Bỏ qua: ${result.skipped}`)
    this.logger.warning(`Lỗi: ${result.errors.length}`)
    for (const e of result.errors.slice(0, 50)) {
      this.logger.error(`  [row ${e.row}] ${e.reason}`)
    }
    if (result.errors.length > 0) this.exitCode = 1
  }
}
