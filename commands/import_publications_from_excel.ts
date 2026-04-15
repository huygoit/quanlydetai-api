import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import PublicationExcelImportService from '#services/publication_excel_import_service'

export default class ImportPublicationsFromExcel extends BaseCommand {
  static commandName = 'import:publications-excel'
  static description = 'Import bài báo + chi tiết tác giả từ file Excel 2 sheet'
  static options: CommandOptions = { startApp: true }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn file Excel',
  })
  declare file?: string

  @flags.string({
    flagName: 'sheet-publications',
    description: 'Tên sheet danh sách bài báo',
  })
  declare sheetPublications?: string

  @flags.string({
    flagName: 'sheet-details',
    description: 'Tên sheet chi tiết tác giả',
  })
  declare sheetDetails?: string

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Chạy thử, không ghi DB',
  })
  declare dryRun: boolean

  async run() {
    const file = this.file || 'C:/quanlydetai/tailieu/import_bai_bao.xlsx'
    const sheetPublications = this.sheetPublications || 'DMBaiBao_2025_2026'
    const sheetDetails = this.sheetDetails || 'DMBaiBaoChiTiet'

    const summary = await PublicationExcelImportService.run({
      file,
      publicationSheet: sheetPublications,
      detailSheet: sheetDetails,
      dryRun: this.dryRun,
    })

    this.logger.info(`file: ${file}`)
    this.logger.info(`sheet bài báo: ${sheetPublications}`)
    this.logger.info(`sheet chi tiết: ${sheetDetails}`)
    this.logger.info(`tổng bài đọc: ${summary.totalPublications}`)
    this.logger.success(`bài tạo mới: ${summary.createdPublications}`)
    this.logger.info(`bài cập nhật: ${summary.updatedPublications}`)
    this.logger.warning(`bài bỏ qua: ${summary.skippedPublications}`)
    this.logger.success(`tác giả đã ghi: ${summary.createdAuthors}`)
    this.logger.warning(`cảnh báo: ${summary.warnings.length}`)
    this.logger.warning(`lỗi: ${summary.errors.length}`)

    for (const w of summary.warnings.slice(0, 100)) {
      this.logger.warning(w)
    }
    for (const e of summary.errors.slice(0, 200)) {
      this.logger.error(e)
    }
    if (summary.errors.length > 0) this.exitCode = 1
  }
}
