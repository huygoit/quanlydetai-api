import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng danh mục dùng chung (FIELD, UNIT, PROJECT_LEVEL, LANGUAGE, ...).
 */
export default class extends BaseSchema {
  protected tableName = 'catalogs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('type', 50).notNullable()
      table.string('code', 50).notNullable()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table
        .bigInteger('parent_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('catalogs')
        .onDelete('SET NULL')
      table.jsonb('metadata').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.unique(['type', 'code'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
