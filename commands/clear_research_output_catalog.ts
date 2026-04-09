import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

/**
 * Xóa toàn bộ danh mục "Loại kết quả NCKH" (cây + rule quy đổi).
 * Bảng: research_output_rules trước (FK), research_output_types — dùng TRUNCATE CASCADE.
 */
export default class ClearResearchOutputCatalog extends BaseCommand {
  static commandName = 'clear:research-output-catalog'
  static description =
    'Xóa hết dữ liệu bảng research_output_types và research_output_rules (danh mục loại kết quả NCKH)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    flagName: 'yes',
    alias: 'y',
    description: 'Bắt buộc để xác nhận xóa (tránh chạy nhầm)',
  })
  declare yes: boolean

  async run() {
    if (!this.yes) {
      this.logger.error('Thêm --yes để xác nhận xóa toàn bộ danh mục loại kết quả NCKH.')
      this.exitCode = 1
      return
    }

    await db.rawQuery(
      'TRUNCATE TABLE research_output_rules, research_output_types RESTART IDENTITY CASCADE'
    )
    this.logger.success('Đã TRUNCATE research_output_rules và research_output_types (ID reset).')
  }
}
