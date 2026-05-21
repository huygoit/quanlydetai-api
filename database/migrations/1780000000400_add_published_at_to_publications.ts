import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ngày xuất bản đầy đủ (bổ sung year hiện có).
 */
export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('published_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('published_at')
    })
  }
}
