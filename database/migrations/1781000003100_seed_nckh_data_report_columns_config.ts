import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Seed khóa cấu hình cột báo cáo Thống kê kết quả NCKH.
 * value null = chưa cấu hình → API mặc định chọn hết node active.
 */
export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      INSERT INTO system_configs (key, value, description, created_at, updated_at)
      SELECT
        'nckh_data_report_columns',
        NULL,
        'Cột hiển thị báo cáo Thống kê kết quả NCKH (JSON: level1Ids, level2Ids, level3Ids)',
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM system_configs WHERE key = 'nckh_data_report_columns'
      )
    `)
  }

  async down() {
    await this.db.rawQuery(`
      DELETE FROM system_configs WHERE key = 'nckh_data_report_columns'
    `)
  }
}
