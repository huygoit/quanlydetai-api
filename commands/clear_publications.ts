import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

/**
 * Xóa toàn bộ bài báo / kết quả công bố.
 * TRUNCATE publications CASCADE sẽ kéo theo publication_authors (FK onDelete CASCADE).
 */
export default class ClearPublications extends BaseCommand {
  static commandName = 'clear:publications'
  static description = 'Xóa hết dữ liệu bảng publications và publication_authors'

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
      this.logger.error('Thêm --yes để xác nhận xóa toàn bộ bài báo.')
      this.exitCode = 1
      return
    }

    const beforePubs = await db.from('publications').count('* as total').first()
    const beforeAuthors = await db.from('publication_authors').count('* as total').first()
    this.logger.info(`Trước khi xóa: publications=${beforePubs?.total ?? 0}, authors=${beforeAuthors?.total ?? 0}`)

    await db.rawQuery('TRUNCATE TABLE publications RESTART IDENTITY CASCADE')

    const afterPubs = await db.from('publications').count('* as total').first()
    const afterAuthors = await db.from('publication_authors').count('* as total').first()
    this.logger.success(
      `Đã TRUNCATE publications (CASCADE publication_authors). Còn lại: publications=${afterPubs?.total ?? 0}, authors=${afterAuthors?.total ?? 0}`
    )
  }
}
