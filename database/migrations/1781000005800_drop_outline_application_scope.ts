import { BaseSchema } from '@adonisjs/lucid/schema'

/** Bỏ trường phạm vi ứng dụng trên thuyết minh */
export default class extends BaseSchema {
  protected tableName = 'project_outlines'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('application_scope')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('application_scope').nullable()
    })
  }
}
