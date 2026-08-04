import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ProjectProcessType from '#models/project_process_type'

/**
 * Seed 5 loại quy trình đề tài chuẩn.
 * Chạy: node ace db:seed --files=database/seeders/16_project_process_type_seeder.ts
 */
const ITEMS = [
  { code: 'QT-I', name: 'Đề tài cấp Trường' },
  { code: 'QT-II', name: 'Đề tài cấp Bộ GD&ĐT / ĐHĐN' },
  { code: 'QT-III', name: 'Đề tài cấp Tỉnh/Thành phố & Doanh nghiệp đặt hàng' },
  { code: 'QT-IV', name: 'Đề tài do Quỹ NAFOSTED, VinIF và các quỹ tài trợ' },
  { code: 'QT-V', name: 'Hợp đồng Dịch vụ KH&CN với doanh nghiệp/đối tác' },
]

export default class extends BaseSeeder {
  async run() {
    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i]
      await ProjectProcessType.updateOrCreate(
        { code: item.code },
        {
          name: item.name,
          description: null,
          displayOrder: (i + 1) * 10,
          status: 'ACTIVE',
        }
      )
    }
  }
}
