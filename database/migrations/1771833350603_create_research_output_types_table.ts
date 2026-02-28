import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng cây phân cấp "Loại kết quả NCKH" (2–3 cấp).
 * Admin quản lý: level 1..3, parent_id, sort_order.
 */
export default class extends BaseSchema {
  protected tableName = 'research_output_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('parent_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('RESTRICT')
      table.string('code', 50).notNullable().unique()
      table.string('name', 255).notNullable()
      table.integer('level').notNullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.text('note').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('parent_id')
      table.index(['parent_id', 'sort_order'])
    })
    this.schema.raw(
      "ALTER TABLE research_output_types ADD CONSTRAINT research_output_types_level_check CHECK (level IN (1, 2, 3))"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
