import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'

/**
 * Quyền danh mục chức vụ nhân sự.
 * Chạy: node ace db:seed --files=database/seeders/19_staff_position_permissions_seeder.ts
 */
const TO_ADD: Array<{ code: string; name: string; module: string; action: string }> = [
  {
    code: 'staff_position.view',
    name: 'Xem danh mục chức vụ',
    module: 'staff_position',
    action: 'view',
  },
  {
    code: 'staff_position.create',
    name: 'Tạo chức vụ',
    module: 'staff_position',
    action: 'create',
  },
  {
    code: 'staff_position.update',
    name: 'Cập nhật chức vụ',
    module: 'staff_position',
    action: 'update',
  },
  {
    code: 'staff_position.delete',
    name: 'Xóa chức vụ',
    module: 'staff_position',
    action: 'delete',
  },
]

export default class extends BaseSeeder {
  async run() {
    for (const p of TO_ADD) {
      await Permission.updateOrCreate(
        { code: p.code },
        {
          name: p.name,
          module: p.module,
          action: p.action,
          description: null,
          status: 'ACTIVE',
        }
      )
    }
  }
}
