import { BaseSchema } from '@adonisjs/lucid/schema'

/** Đề xuất đề tài: gắn lá loại kết quả NCKH (phục vụ KPI theo rule import). */
export default class extends BaseSchema {
  protected tableName = 'project_proposals'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .bigInteger('research_output_type_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('research_output_types')
        .onDelete('SET NULL')
      table.index('research_output_type_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['research_output_type_id'])
      table.dropForeign(['research_output_type_id'])
      table.dropColumn('research_output_type_id')
    })
  }
}
