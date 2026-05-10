import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Đổi tên cột tránh nhầm lẫn:
 * is_main_author (tác giả chính) -> is_top_author (tác giả đứng đầu)
 */
export default class extends BaseSchema {
  protected tableName = 'publication_authors'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('is_main_author', 'is_top_author')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('is_top_author', 'is_main_author')
    })
  }
}

