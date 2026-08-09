import { BaseSchema } from '@adonisjs/lucid/schema'

/** CFP lưu loại quy trình đề tài từ danh mục (QT-I … QT-V). */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('call_for_proposals', (table) => {
      table.jsonb('project_process_type_ids').notNullable().defaultTo('[]')
    })
  }

  async down() {
    this.schema.alterTable('call_for_proposals', (table) => {
      table.dropColumn('project_process_type_ids')
    })
  }
}
