import { BaseSchema } from '@adonisjs/lucid/schema'

/** Thuyết minh — khối nội dung khác (ứng dụng, hiệu quả, rủi ro, đạo đức/AI) */
export default class extends BaseSchema {
  protected tableName = 'project_outlines'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('other_contents').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('other_contents')
    })
  }
}
