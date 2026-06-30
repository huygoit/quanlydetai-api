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
  { code: 'publication.view', name: 'Xem kết quả nghiên cứu khoa học', module: 'publication', action: 'view' },
  { code: 'publication.create', name: 'Tạo kết quả nghiên cứu khoa học', module: 'publication', action: 'create' },
  { code: 'publication.update', name: 'Cập nhật kết quả nghiên cứu khoa học', module: 'publication', action: 'update' },
  { code: 'publication.delete', name: 'Xóa kết quả nghiên cứu khoa học', module: 'publication', action: 'delete' },
  { code: 'publication.review', name: 'Yêu cầu hiệu chỉnh kết quả nghiên cứu khoa học', module: 'publication', action: 'review' },
  { code: 'publication.approve', name: 'Duyệt kết quả nghiên cứu khoa học', module: 'publication', action: 'approve' },
  { code: 'field.view', name: 'Xem danh mục lĩnh vực', module: 'field', action: 'view' },
  { code: 'field.create', name: 'Tạo lĩnh vực', module: 'field', action: 'create' },
  { code: 'field.update', name: 'Cập nhật lĩnh vực', module: 'field', action: 'update' },
  { code: 'field.delete', name: 'Xóa lĩnh vực', module: 'field', action: 'delete' },
  { code: 'specialization.view', name: 'Xem danh mục chuyên ngành', module: 'specialization', action: 'view' },
  { code: 'specialization.create', name: 'Tạo chuyên ngành', module: 'specialization', action: 'create' },
  { code: 'specialization.update', name: 'Cập nhật chuyên ngành', module: 'specialization', action: 'update' },
  { code: 'specialization.delete', name: 'Xóa chuyên ngành', module: 'specialization', action: 'delete' },
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
      } else if (exists.name !== p.name) {
        // Đồng bộ lại nhãn theo tên chuẩn mới nhất (vd "công bố" → "kết quả nghiên cứu khoa học").
        exists.name = p.name
        await exists.save()
      }
    }
  }
}
