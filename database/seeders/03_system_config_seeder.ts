import { BaseSeeder } from '@adonisjs/lucid/seeders'
import SystemConfig from '#models/system_config'

/**
 * Seed cấu hình hệ thống mặc định (theo prompt 02-admin-catalogs).
 */
const configs = [
  { key: 'app_name', value: 'Hệ thống Quản lý KH&CN', description: 'Tên ứng dụng' },
  { key: 'app_version', value: '1.0.0', description: 'Phiên bản' },
  { key: 'max_file_size_mb', value: '10', description: 'Kích thước file tối đa (MB)' },
  {
    key: 'allowed_file_types',
    value: 'pdf,doc,docx,xls,xlsx,jpg,png',
    description: 'Loại file cho phép',
  },
  {
    key: 'session_timeout_minutes',
    value: '480',
    description: 'Thời gian hết hạn session (phút)',
  },
  {
    key: 'council_threshold_score',
    value: '7.0',
    description: 'Ngưỡng điểm đề xuất đặt hàng',
  },
]

export default class SystemConfigSeeder extends BaseSeeder {
  async run() {
    for (const row of configs) {
      const exists = await SystemConfig.findBy('key', row.key)
      if (!exists) {
        await SystemConfig.create(row)
      }
    }
  }
}
