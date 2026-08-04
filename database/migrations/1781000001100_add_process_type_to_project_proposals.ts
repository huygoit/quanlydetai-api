import { BaseSchema } from '@adonisjs/lucid/schema'

/** Gắn loại quy trình đề tài (QT-I…QT-V) vào hồ sơ đề xuất */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('project_proposals', (table) => {
      table
        .bigInteger('project_process_type_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('project_process_types')
        .onDelete('SET NULL')
      table.index('project_process_type_id')
    })
  }

  async down() {
    this.schema.alterTable('project_proposals', (table) => {
      table.dropColumn('project_process_type_id')
    })
  }
}
