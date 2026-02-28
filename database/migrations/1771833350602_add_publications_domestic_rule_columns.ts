import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bổ sung cột phục vụ quy đổi giờ NCKH cho bài DOMESTIC/OTHER:
 * domestic_rule_type (HDGSNN_SCORE | CONFERENCE_ISBN), hdgsnn_score.
 */
export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('domestic_rule_type', 30).nullable()
      table.decimal('hdgsnn_score', 10, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('domestic_rule_type')
      table.dropColumn('hdgsnn_score')
    })
  }
}
