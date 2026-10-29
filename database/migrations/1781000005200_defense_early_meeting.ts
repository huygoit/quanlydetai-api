import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * PKH xác nhận họp trước ngày dự kiến → Thư ký được soạn/chốt biên bản sớm.
 */
export default class extends BaseSchema {
  protected tableName = 'project_outline_defense_sessions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('early_meeting_opened').notNullable().defaultTo(false)
      table.timestamp('early_meeting_opened_at', { useTz: true }).nullable()
      table
        .integer('early_meeting_opened_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('early_meeting_opened_by')
      table.dropColumn('early_meeting_opened_at')
      table.dropColumn('early_meeting_opened')
    })
  }
}
