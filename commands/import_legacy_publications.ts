import fs from 'node:fs'
import path from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import LegacyPublicationExcelImportService from '#services/legacy_publication_excel_import_service'

export default class ImportLegacyPublications extends BaseCommand {
  static commandName = 'import:legacy-publications'
  static description = 'Import bài báo từ file kê khai NCKH một sheet'
  static options: CommandOptions = { startApp: true }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn file Excel',
  })
  declare file?: string

  @flags.string({
    flagName: 'sheet',
    description: 'Tên sheet; mặc định dùng sheet đầu tiên',
  })
  declare sheet?: string

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Phân tích nhưng không ghi dữ liệu',
  })
  declare dryRun: boolean

  @flags.boolean({
    flagName: 'update-existing',
    description: 'Cho phép cập nhật bài đã có cùng source_id',
  })
  declare updateExisting: boolean

  @flags.string({
    flagName: 'log-file',
    description: 'Đường dẫn file JSON ghi toàn bộ kết quả, cảnh báo và lỗi',
  })
  declare logFile?: string

  async run() {
    const file = this.file || 'C:/quanlydetai/tailieu/qlht_NCKH_All/qlht_BaiBao_All.xlsx'
    const summary = await LegacyPublicationExcelImportService.run({
      file,
      sheet: this.sheet,
      dryRun: this.dryRun,
      updateExisting: this.updateExisting,
    })

    this.logger.info(`Tệp: ${file}`)
    this.logger.info(`Tổng bài đọc được: ${summary.totalPublications}`)
    this.logger.success(`Tạo mới: ${summary.createdPublications}`)
    this.logger.info(`Cập nhật: ${summary.updatedPublications}`)
    this.logger.info(`Đã tồn tại, không cập nhật: ${summary.existingPublications}`)
    this.logger.warning(`Bỏ qua: ${summary.skippedPublications}`)
    this.logger.success(`Tác giả: ${summary.createdAuthors}`)
    this.logger.info(
      `Hệ số a: a=1 (${summary.inferredA.a1}), a=1,5 (${summary.inferredA.a15}), a=2 (${summary.inferredA.a2}), chưa suy được (${summary.inferredA.unresolved})`
    )
    this.logger.info(
      `Giới tính: nam (${summary.inferredGender.male}), nữ (${summary.inferredGender.female}), chưa xác định (${summary.inferredGender.unresolved})`
    )
    this.logger.info(
      `Đơn vị: khớp (${summary.mappedDepartments}), chưa khớp (${summary.unresolvedDepartments})`
    )
    this.logger.warning(`Cảnh báo: ${summary.warnings.length}`)
    this.logger.warning(`Lỗi: ${summary.errors.length}`)

    for (const warning of summary.warnings.slice(0, 200)) {
      this.logger.warning(warning)
    }
    for (const error of summary.errors.slice(0, 200)) {
      this.logger.error(error)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logFile = path.resolve(
      this.logFile || `storage/logs/import_legacy_publications_${timestamp}.json`
    )
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    fs.writeFileSync(
      logFile,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          file,
          sheet: this.sheet ?? null,
          dryRun: this.dryRun,
          updateExisting: this.updateExisting,
          summary,
        },
        null,
        2
      ),
      'utf8'
    )
    this.logger.success(`Đã ghi log: ${logFile}`)

    if (summary.errors.length) this.exitCode = 1
  }
}
