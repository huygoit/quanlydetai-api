# Prompt 03: Notifications Module

Tôi cần bạn tạo API Notifications cho hệ thống "Quản lý KH&CN" bằng AdonisJS + PostgreSQL.

## 1. Database Schema

### Bảng `notifications`
```sql
- id: bigint, PK
- user_id: bigint, FK to users, not null (người nhận)
- type: varchar(50), not null
  -- Các type: PROFILE_SUBMITTED, PROFILE_VERIFIED, PROFILE_NEED_INFO, 
  -- PUBLICATION_SYNC, IDEA_STATUS_CHANGED, PROJECT_UPDATE, SYSTEM
- title: varchar(255), not null
- message: text, not null
- link: varchar(500), nullable (link để điều hướng khi click)
- read: boolean, default false (KHÔNG dùng is_read)
- created_at: timestamp
```

**LƯU Ý:**
- Dùng field `read` thay vì `is_read` để khớp với frontend
- Model AdonisJS có thể dùng column name khác: `@column({ columnName: 'read' }) public read: boolean`

## 2. Notification Types

```typescript
type NotificationType =
  | 'PROFILE_SUBMITTED'    // NCV gửi cập nhật hồ sơ
  | 'PROFILE_VERIFIED'     // Phòng KH xác thực hồ sơ
  | 'PROFILE_NEED_INFO'    // Yêu cầu bổ sung hồ sơ
  | 'PUBLICATION_SYNC'     // Có công bố gợi ý mới
  | 'IDEA_STATUS_CHANGED'  // Ý tưởng thay đổi trạng thái
  | 'PROJECT_UPDATE'       // Cập nhật đề tài
  | 'SYSTEM'               // Thông báo hệ thống
```

## 3. API Endpoints

### GET /api/notifications
Lấy notifications của current user
Query params: `page`, `perPage`, `read` (boolean, optional để lọc đã đọc/chưa đọc)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 6,
      "type": "IDEA_STATUS_CHANGED",
      "title": "Ý tưởng đã được phê duyệt",
      "message": "Ý tưởng YT-2024-001 của bạn đã được phê duyệt đặt hàng.",
      "link": "/ideas/1",
      "read": false,
      "createdAt": "2024-03-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 50,
    "currentPage": 1,
    "perPage": 10,
    "lastPage": 5,
    "unreadCount": 8
  }
}
```

**LƯU Ý:** Response field `read` (boolean) phải dùng đúng tên này, KHÔNG dùng `isRead`.

### GET /api/notifications/unread-count
Response:
```json
{
  "success": true,
  "data": { "count": 8 }
}
```

### PUT /api/notifications/:id/read
Đánh dấu 1 notification đã đọc

Response:
```json
{
  "success": true,
  "message": "Đã đánh dấu đã đọc"
}
```

### PUT /api/notifications/read-all
Đánh dấu tất cả notifications của user đã đọc

Response:
```json
{
  "success": true,
  "message": "Đã đánh dấu tất cả đã đọc"
}
```

### DELETE /api/notifications/:id
Xóa 1 notification

### DELETE /api/notifications/clear-all
Xóa tất cả notifications của user

## 4. NotificationService

Tạo service để các module khác gọi khi cần gửi notification:

```typescript
// app/services/notification_service.ts
import Notification from '#models/notification'
import User from '#models/user'

export default class NotificationService {
  /**
   * Gửi notification đến 1 user
   */
  static async push(userId: number, data: {
    type: string
    title: string
    message: string
    link?: string
  }) {
    return await Notification.create({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
    })
  }

  /**
   * Gửi notification đến nhiều users
   */
  static async pushMany(userIds: number[], data: {
    type: string
    title: string
    message: string
    link?: string
  }) {
    const notifications = userIds.map(userId => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
    }))
    return await Notification.createMany(notifications)
  }

  /**
   * Gửi notification đến tất cả users có role nhất định
   */
  static async pushToRole(role: string, data: {
    type: string
    title: string
    message: string
    link?: string
  }) {
    const users = await User.query().where('role', role).where('isActive', true)
    const userIds = users.map(u => u.id)
    if (userIds.length > 0) {
      return await this.pushMany(userIds, data)
    }
    return []
  }

  /**
   * Gửi notification đến nhiều roles
   */
  static async pushToRoles(roles: string[], data: {
    type: string
    title: string
    message: string
    link?: string
  }) {
    const users = await User.query().whereIn('role', roles).where('isActive', true)
    const userIds = users.map(u => u.id)
    if (userIds.length > 0) {
      return await this.pushMany(userIds, data)
    }
    return []
  }

  // ============ TRIGGER FUNCTIONS ============

  /**
   * Khi NCV submit cập nhật hồ sơ → thông báo PHONG_KH
   */
  static async notifyProfileSubmitted(profileId: number, profileName: string) {
    await this.pushToRole('PHONG_KH', {
      type: 'PROFILE_SUBMITTED',
      title: 'Hồ sơ mới cập nhật',
      message: `Hồ sơ khoa học của ${profileName} đã gửi cập nhật. Vui lòng xem xét.`,
      link: `/profile/${profileId}`,
    })
  }

  /**
   * Khi PHONG_KH xác thực hồ sơ → thông báo NCV
   */
  static async notifyProfileVerified(userId: number) {
    await this.push(userId, {
      type: 'PROFILE_VERIFIED',
      title: 'Hồ sơ đã được xác thực',
      message: 'Hồ sơ khoa học của bạn đã được Phòng KH xác thực thành công.',
      link: '/profile/me',
    })
  }

  /**
   * Khi PHONG_KH yêu cầu bổ sung → thông báo NCV
   */
  static async notifyNeedMoreInfo(userId: number, reason: string) {
    await this.push(userId, {
      type: 'PROFILE_NEED_INFO',
      title: 'Yêu cầu bổ sung hồ sơ',
      message: `Hồ sơ khoa học cần bổ sung: ${reason}`,
      link: '/profile/me',
    })
  }

  /**
   * Khi ý tưởng thay đổi trạng thái → thông báo owner
   */
  static async notifyIdeaStatusChanged(
    userId: number,
    ideaCode: string,
    newStatus: string,
    ideaId: number
  ) {
    const statusLabels: Record<string, string> = {
      REVIEWING: 'đang được sơ loại',
      APPROVED_INTERNAL: 'đã được sơ loại',
      PROPOSED_FOR_ORDER: 'đã được đề xuất đặt hàng',
      APPROVED_FOR_ORDER: 'đã được phê duyệt đặt hàng',
      REJECTED: 'đã bị từ chối',
    }
    const statusLabel = statusLabels[newStatus] || newStatus

    await this.push(userId, {
      type: 'IDEA_STATUS_CHANGED',
      title: `Ý tưởng ${statusLabel}`,
      message: `Ý tưởng ${ideaCode} của bạn ${statusLabel}.`,
      link: `/ideas/${ideaId}`,
    })
  }

  /**
   * Khi đề xuất đề tài thay đổi trạng thái → thông báo owner
   */
  static async notifyProjectProposalStatusChanged(
    userId: number,
    proposalCode: string,
    newStatus: string,
    proposalId: number
  ) {
    const statusLabels: Record<string, string> = {
      UNIT_REVIEWED: 'đã được đơn vị cho ý kiến',
      APPROVED: 'đã được phê duyệt',
      REJECTED: 'không được phê duyệt',
    }
    const statusLabel = statusLabels[newStatus] || newStatus

    await this.push(userId, {
      type: 'PROJECT_UPDATE',
      title: `Đề xuất ${statusLabel}`,
      message: `Đề xuất ${proposalCode} của bạn ${statusLabel}.`,
      link: `/projects/register?id=${proposalId}`,
    })
  }

  /**
   * Thông báo hệ thống đến tất cả users
   */
  static async notifySystem(title: string, message: string) {
    const users = await User.query().where('isActive', true)
    const userIds = users.map(u => u.id)
    if (userIds.length > 0) {
      await this.pushMany(userIds, {
        type: 'SYSTEM',
        title,
        message,
      })
    }
  }
}
```

## 5. Seed Data

Tạo một vài notifications mẫu:
```typescript
const notifications = [
  {
    userId: 6, // ncv@university.edu.vn
    type: 'PROFILE_VERIFIED',
    title: 'Hồ sơ đã được xác thực',
    message: 'Hồ sơ khoa học của bạn đã được Phòng KH xác thực thành công.',
    link: '/profile/me',
    isRead: true,
  },
  {
    userId: 6,
    type: 'IDEA_STATUS_CHANGED',
    title: 'Ý tưởng đã được sơ loại',
    message: 'Ý tưởng YT-2024-001 của bạn đã được sơ loại.',
    link: '/ideas/1',
    isRead: false,
  },
  {
    userId: 2, // phongkh
    type: 'PROFILE_SUBMITTED',
    title: 'Hồ sơ mới cập nhật',
    message: 'Hồ sơ khoa học của Nguyễn Văn A đã gửi cập nhật. Vui lòng xem xét.',
    link: '/profile/1',
    isRead: false,
  },
]
```

## 6. Yêu cầu

Hãy tạo đầy đủ:
1. Migration file cho bảng notifications
2. Model Notification
3. NotificationsController
4. NotificationService
5. Routes
6. Seeder (NotificationSeeder)

## 7. Sau khi tạo xong, chạy:

```bash
# Chạy migration
node ace migration:run

# Chạy seeder
node ace db:seed
```
