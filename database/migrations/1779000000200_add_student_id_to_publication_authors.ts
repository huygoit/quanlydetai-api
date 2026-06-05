import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Liên kết tác giả công bố với sinh viên (bảng students), song song profile_id (hồ sơ NCV).
 */
export default class extends BaseSchema {
  protected tableName = 'publication_authors'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .bigInteger('student_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('students')
        .onDelete('SET NULL')
      table.index('student_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('student_id')
    })
  }
}
