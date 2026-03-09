import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng pivot role_permissions.
 */
export default class extends BaseSchema {
  protected tableName = 'role_permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.bigInteger('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE')
      table.bigInteger('permission_id').unsigned().notNullable().references('id').inTable('permissions').onDelete('CASCADE')
      table.timestamp('created_at').notNullable()

      table.unique(['role_id', 'permission_id'])
      table.index('role_id')
      table.index('permission_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
