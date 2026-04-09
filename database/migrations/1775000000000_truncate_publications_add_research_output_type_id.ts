import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

/**
 * Xóa toàn bộ công bố + tác giả cũ, thêm FK research_output_type_id (bắt buộc) trỏ lá danh mục NCKH.
 */
export default class extends BaseSchema {
  async up() {
    await db.rawQuery('TRUNCATE TABLE publication_authors RESTART IDENTITY CASCADE')
    await db.rawQuery('TRUNCATE TABLE publications RESTART IDENTITY CASCADE')

    this.schema.alterTable('publications', (table) => {
      table
        .bigInteger('research_output_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('research_output_types')
        .onDelete('RESTRICT')
      table.index('research_output_type_id')
    })
  }

  async down() {
    this.schema.alterTable('publications', (table) => {
      table.dropIndex(['research_output_type_id'])
      table.dropForeign(['research_output_type_id'])
      table.dropColumn('research_output_type_id')
    })
  }
}
