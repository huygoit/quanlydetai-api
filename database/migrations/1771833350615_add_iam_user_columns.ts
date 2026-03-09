import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Thêm các cột cho IAM user management: department_id, note, last_login_at.
 * Không xóa cột cũ, chỉ alter thêm.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('department_id').unsigned().nullable().references('id').inTable('departments').onDelete('SET NULL')
      table.text('note').nullable()
      table.timestamp('last_login_at').nullable()

      table.index('department_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('department_id')
      table.dropColumn('note')
      table.dropColumn('last_login_at')
    })
  }
}
