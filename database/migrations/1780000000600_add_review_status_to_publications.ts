import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Trạng thái duyệt KQNC: NEW | CORRECTION_REQUESTED | CORRECTED | APPROVED
 */
export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .string('review_status', 32)
        .notNullable()
        .defaultTo('NEW')
        .comment('Trạng thái duyệt: NEW, CORRECTION_REQUESTED, CORRECTED, APPROVED')
      table
        .text('correction_reason')
        .nullable()
        .comment('Lý do yêu cầu hiệu chỉnh (bắt buộc khi chuyển sang CORRECTION_REQUESTED)')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('review_status')
      table.dropColumn('correction_reason')
    })
  }
}
