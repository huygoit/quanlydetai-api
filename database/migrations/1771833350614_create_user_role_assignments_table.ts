import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng gán role cho user.
 */
export default class extends BaseSchema {
  protected tableName = 'user_role_assignments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.bigInteger('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE')
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('start_at').nullable()
      table.timestamp('end_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['user_id', 'role_id'])
      table.index('user_id')
      table.index('role_id')
      table.index('is_active')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
