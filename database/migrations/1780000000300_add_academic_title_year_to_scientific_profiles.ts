import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Năm công nhận học hàm (PGS/GS) — tách khỏi degree_year.
 */
export default class extends BaseSchema {
  protected tableName = 'scientific_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('academic_title_year').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('academic_title_year')
    })
  }
}
