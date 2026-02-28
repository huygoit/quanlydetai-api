import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng cache KPI theo profile + năm học (tổng giờ, đạt định mức, chi tiết).
 */
export default class extends BaseSchema {
  protected tableName = 'kpi_results'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('profile_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('scientific_profiles')
        .onDelete('CASCADE')
      table.string('academic_year', 9).notNullable()
      table.decimal('total_hours', 12, 2).notNullable().defaultTo(0)
      table.boolean('met_quota').notNullable().defaultTo(false)
      table.jsonb('detail').notNullable().defaultTo('{}')
      table.timestamp('created_at').nullable()
      table.timestamp('updated_at').nullable()

      table.unique(['profile_id', 'academic_year'])
      table.index('profile_id')
      table.index('academic_year')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
