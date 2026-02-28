import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration bổ sung các cột cho bảng users theo đặc tả Auth & Users:
 * role, role_label, avatar_url, phone, unit, is_active
 * và đổi full_name thành not null.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('role', 50).notNullable().defaultTo('NCV')
      table.string('role_label', 100).nullable()
      table.text('avatar_url').nullable()
      table.string('phone', 20).nullable()
      table.string('unit', 255).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
      table.dropColumn('role_label')
      table.dropColumn('avatar_url')
      table.dropColumn('phone')
      table.dropColumn('unit')
      table.dropColumn('is_active')
    })
  }
}
