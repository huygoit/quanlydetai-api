import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bổ sung cột xếp loại nghiệm thu cho công bố là đề tài (rule MULTIPLY_C).
 * Giá trị: EXCELLENT (Xuất sắc), PASS_ON_TIME (Đạt đúng hạn), PASS_LATE (Đạt chậm).
 * Hệ số c tương ứng lấy theo cấu hình meta.c_map của loại kết quả.
 */
export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .string('acceptance_grade', 20)
        .nullable()
        .comment('Xếp loại nghiệm thu đề tài: EXCELLENT | PASS_ON_TIME | PASS_LATE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('acceptance_grade')
    })
  }
}
