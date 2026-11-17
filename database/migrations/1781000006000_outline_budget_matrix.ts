import { BaseSchema } from '@adonisjs/lucid/schema'

/** Thuyết minh — ma trận kinh phí (nguồn × khoản chi) */
export default class extends BaseSchema {
  protected tableName = 'project_outlines'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('budget_matrix').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('budget_matrix')
    })
  }
}
