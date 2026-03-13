import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'

/**
 * Bổ sung các permission còn thiếu cho role Basic và IAM.
 * Chỉ tạo nếu chưa tồn tại (theo code) - không ảnh hưởng dữ liệu hiện có.
 */
const TO_ADD: Array<{ code: string; name: string; module: string; action: string }> = [
  { code: 'profile.view_own', name: 'Xem hồ sơ của mình', module: 'profile', action: 'view_own' },
  { code: 'profile.update_own', name: 'Cập nhật hồ sơ của mình', module: 'profile', action: 'update_own' },
  { code: 'idea.view', name: 'Xem ý tưởng', module: 'idea', action: 'view' },
  { code: 'idea.create', name: 'Tạo ý tưởng', module: 'idea', action: 'create' },
  { code: 'idea.update', name: 'Cập nhật ý tưởng', module: 'idea', action: 'update' },
  { code: 'idea.submit', name: 'Gửi ý tưởng', module: 'idea', action: 'submit' },
  { code: 'idea.delete', name: 'Xóa ý tưởng', module: 'idea', action: 'delete' },
]

export default class MissingPermissionsSeeder extends BaseSeeder {
  async run() {
    for (const p of TO_ADD) {
      const exists = await Permission.query().where('code', p.code).first()
      if (!exists) {
        await Permission.create({
          code: p.code,
          name: p.name,
          module: p.module,
          action: p.action,
          description: null,
          status: 'ACTIVE',
        })
      }
    }
  }
}
