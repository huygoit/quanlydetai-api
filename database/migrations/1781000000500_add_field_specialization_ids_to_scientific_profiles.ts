import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Tham chiếu danh mục cho hồ sơ khoa học:
 * - research_field_id   → fields.id (lĩnh vực nghiên cứu)
 * - specialization_id   → specializations.id (chuyên ngành)
 * Giữ song song với cột text (main_research_area, specialization) để hiển thị.
 */
export default class extends BaseSchema {
  protected tableName = 'scientific_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('research_field_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('fields')
        .onDelete('SET NULL')
      table
        .integer('specialization_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('specializations')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('research_field_id')
      table.dropColumn('specialization_id')
    })
  }
}
