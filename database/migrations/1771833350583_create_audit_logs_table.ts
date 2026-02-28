import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng nhật ký audit (hành động user trên các entity).
 */
export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('user_name', 255).notNullable()
      table.string('action', 50).notNullable()
      table.string('entity_type', 50).notNullable()
      table.string('entity_id', 50).nullable()
      table.jsonb('old_data').nullable()
      table.jsonb('new_data').nullable()
      table.string('ip_address', 50).notNullable()
      table.text('user_agent').nullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
