import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import StudentImportService from '#services/student_import_service'

/**
 * Import sinh viên từ Excel (sheet SinhVien, map đơn vị qua DonVi_Nganh).
 * File mặc định: prompts/data-for-kpi04-05.xlsx
 *
 * Chạy: node ace import:students
 * Hoặc:  node ace import:students prompts/other.xlsx
 */
export default class ImportStudents extends BaseCommand {
  static commandName = 'import:students'
  static description = 'Import sinh viên từ Excel (prompts/data-for-kpi04-05.xlsx)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const customArg = process.argv[3]
    const customFile = typeof customArg === 'string' && customArg.trim() ? customArg.trim() : undefined
    const filePath = customFile ? StudentImportService.getFilePath(customFile) : StudentImportService.getFilePath(StudentImportService.DEFAULT_FILE)
    this.logger.info(`Đang đọc file: ${filePath}`)

    const result = await StudentImportService.runImport(customFile ?? StudentImportService.DEFAULT_FILE)

    this.logger.info(`Tổng dòng: ${result.total}`)
    this.logger.success(`Thêm mới: ${result.inserted}`)
    this.logger.success(`Cập nhật: ${result.updated}`)
    this.logger.info(`Bỏ qua: ${result.skipped}`)
    if (result.failed > 0) {
      this.logger.warning(`Lỗi: ${result.failed}`)
      for (const err of result.errors) {
        this.logger.error(`  [dòng ${err.rowNumber}] ${err.reason}`)
      }
    }

    const errorLogPath = (result as { errorLogPath?: string }).errorLogPath
    if (errorLogPath) this.logger.warning(`Chi tiết lỗi (file): ${errorLogPath}`)
  }
}