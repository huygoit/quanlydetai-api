import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng roles cho RBAC.
 */
export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('code', 80).notNullable().unique()
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.string('status', 20).notNullable().defaultTo('ACTIVE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('code')
      table.index('status')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
