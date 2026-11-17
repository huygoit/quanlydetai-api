import { BaseSchema } from '@adonisjs/lucid/schema'

/** Thuyết minh — kết quả/sản phẩm dự kiến (5 nhóm) */
export default class extends BaseSchema {
  protected tableName = 'project_outlines'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('expected_results').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('expected_results')
    })
  }
}
