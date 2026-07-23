import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'publication_authors'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .bigInteger('department_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('departments')
        .onDelete('SET NULL')
      table.index('department_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('department_id')
    })
  }
}
