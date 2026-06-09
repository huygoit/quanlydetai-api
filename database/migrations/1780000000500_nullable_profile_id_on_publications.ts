import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Module quản lý KQNC không có khái niệm chủ kê khai — profile_id chỉ dùng luồng /profile/me.
 */
export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('profile_id').unsigned().nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('profile_id').unsigned().notNullable().alter()
    })
  }
}
