import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng thông báo (người nhận, type, title, message, link, read).
 */
export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table
        .bigInteger('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('type', 50).notNullable()
      table.string('title', 255).notNullable()
      table.text('message').notNullable()
      table.string('link', 500).nullable()
      table.boolean('read').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
