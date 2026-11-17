import { BaseSchema } from '@adonisjs/lucid/schema'

/** Thuyết minh — snapshot thông tin chủ nhiệm nhiệm vụ */
export default class extends BaseSchema {
  protected tableName = 'project_outlines'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('principal_info').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('principal_info')
    })
  }
}
