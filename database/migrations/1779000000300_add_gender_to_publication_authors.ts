import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Giới tính tác giả nhập tay (không liên kết profile_id / student_id).
 * Giá trị: MALE | FEMALE | OTHER — khớp FE.
 */
export default class extends BaseSchema {
  protected tableName = 'publication_authors'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('gender', 10).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('gender')
    })
  }
}
