import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Chuẩn hóa DB quy đổi giờ:
 * 1) DROP bảng research_output_rules legacy (không giữ data).
 * 2) RENAME research_output_type_rules -> research_output_rules (canonical).
 * Dùng hasTable để tránh lỗi nếu đã chạy một phần.
 */
export default class extends BaseSchema {
  async up() {
    if (await this.schema.hasTable('research_output_rules')) {
      this.schema.dropTable('research_output_rules')
    }
    if (await this.schema.hasTable('research_output_type_rules')) {
      this.schema.raw('ALTER TABLE research_output_type_rules RENAME TO research_output_rules')
    }
  }

  async down() {
    if (await this.schema.hasTable('research_output_rules')) {
      this.schema.raw('ALTER TABLE research_output_rules RENAME TO research_output_type_rules')
    }
  }
}
