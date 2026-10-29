import { BaseSchema } from '@adonisjs/lucid/schema'

/** BM-02.09: 3 điều kiện trước khi chấm + kết luận mới */
export default class extends BaseSchema {
  protected tableName = 'project_outline_review_score_sheets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('precheck_eligible').nullable()
      table.boolean('precheck_conflict_cleared').nullable()
      table.boolean('precheck_ethics_ok').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('precheck_eligible')
      table.dropColumn('precheck_conflict_cleared')
      table.dropColumn('precheck_ethics_ok')
    })
  }
}
