import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Notification from '#models/notification'

/**
 * Seed thông báo mẫu (theo prompt 03-notifications).
 * userId 6 = ncv, userId 2 = phongkh (theo thứ tự trong user_seeder).
 */
const notifications = [
  {
    userId: 6,
    type: 'PROFILE_VERIFIED',
    title: 'Hồ sơ đã được xác thực',
    message: 'Hồ sơ khoa học của bạn đã được Phòng KH xác thực thành công.',
    link: '/profile/me',
    read: true,
  },
  {
    userId: 6,
    type: 'IDEA_STATUS_CHANGED',
    title: 'Ý tưởng đã được sơ loại',
    message: 'Ý tưởng YT-2024-001 của bạn đã được sơ loại.',
    link: '/ideas/1',
    read: false,
  },
  {
    userId: 2,
    type: 'PROFILE_SUBMITTED',
    title: 'Hồ sơ mới cập nhật',
    message: 'Hồ sơ khoa học của Nguyễn Văn A đã gửi cập nhật. Vui lòng xem xét.',
    link: '/profile/1',
    read: false,
  },
]

export default class NotificationSeeder extends BaseSeeder {
  async run() {
    for (const row of notifications) {
      await Notification.create(row)
    }
  }
}
