import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'projects'

  async up() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'research_startup_field_id')
    if (hasColumn) return

    this.schema.alterTable(this.tableName, (table) => {
      table
        .bigInteger('research_startup_field_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('research_startup_fields')
        .onDelete('SET NULL')

      table.index('research_startup_field_id')
    })
  }

  async down() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'research_startup_field_id')
    if (!hasColumn) return

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('research_startup_field_id')
    })
  }
}