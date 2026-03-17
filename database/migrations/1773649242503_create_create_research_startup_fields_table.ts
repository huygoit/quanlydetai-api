import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'research_startup_fields'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 100).notNullable().unique()
      table.string('name', 255).notNullable()
      table.string('type', 20).notNullable()
      table
        .bigInteger('parent_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('SET NULL')
      table.text('description').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('deleted_at').nullable()

      table.index('type')
      table.index('parent_id')
      table.index('is_active')
    })

    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT ${this.tableName}_type_check CHECK (type IN ('RESEARCH','STARTUP','COMMON'))`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}