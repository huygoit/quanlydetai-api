import { BaseSchema } from '@adonisjs/lucid/schema'

/** Bổ sung cột thành viên thuyết minh — khớp AuthorsEditor / đề xuất */
export default class extends BaseSchema {
  protected tableName = 'project_outline_members'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('gender', 20).nullable()
      table.boolean('is_multi_affiliation_outside_udn').notNullable().defaultTo(false)
      table.decimal('contribution_percent', 5, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('gender')
      table.dropColumn('is_multi_affiliation_outside_udn')
      table.dropColumn('contribution_percent')
    })
  }
}
