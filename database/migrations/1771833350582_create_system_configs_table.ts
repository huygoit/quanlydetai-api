import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng cấu hình hệ thống (key-value).
 */
export default class extends BaseSchema {
  protected tableName = 'system_configs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('key', 100).notNullable().unique()
      table.text('value').nullable()
      table.string('description', 500).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
