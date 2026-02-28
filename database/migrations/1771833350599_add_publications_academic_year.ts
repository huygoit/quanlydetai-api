import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bổ sung academic_year cho publications (năm học, VD 2024-2025).
 */
export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('academic_year', 9).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('academic_year')
    })
  }
}
