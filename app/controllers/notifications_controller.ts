import type { HttpContext } from '@adonisjs/core/http'
import Notification from '#models/notification'

/**
 * Controller thông báo: lấy danh sách của user đăng nhập, đánh dấu đọc, xóa.
 */
export default class NotificationsController {
  /**
   * GET /api/notifications
   * Query: page, perPage, read (optional boolean)
   * Response có meta.unreadCount
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const readParam = request.input('read', '')

    const q = Notification.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')

    if (readParam === 'true' || readParam === '1') {
      q.where('read', true)
    } else if (readParam === 'false' || readParam === '0') {
      q.where('read', false)
    }

    const [paginated, unreadRow] = await Promise.all([
      q.clone().paginate(page, perPage),
      Notification.query()
        .where('user_id', user.id)
        .where('read', false)
        .count('*', 'total')
        .first(),
    ])

    const data = paginated.all().map((n) => this.serialize(n))
    const unreadTotal = Number((unreadRow?.$extras as { total?: string } | undefined)?.total ?? 0)

    return response.ok({
      success: true,
      data,
      meta: {
        total: paginated.total,
        currentPage: paginated.currentPage,
        perPage: paginated.perPage,
        lastPage: paginated.lastPage,
        unreadCount: unreadTotal,
      },
    })
  }

  /**
   * GET /api/notifications/unread-count
   */
  async unreadCount({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const row = await Notification.query()
      .where('user_id', user.id)
      .where('read', false)
      .count('*', 'total')
      .first()
    const total = Number((row?.$extras as { total?: string } | undefined)?.total ?? 0)
    return response.ok({ success: true, data: { count: total } })
  }

  /**
   * PUT /api/notifications/:id/read
   */
  async markRead({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const notification = await Notification.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()
    if (!notification) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    notification.read = true
    await notification.save()
    return response.ok({ success: true, message: 'Đã đánh dấu đã đọc' })
  }

  /**
   * PUT /api/notifications/read-all
   */
  async markAllRead({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    await Notification.query().where('user_id', user.id).where('read', false).update({ read: true })
    return response.ok({ success: true, message: 'Đã đánh dấu tất cả đã đọc' })
  }

  /**
   * DELETE /api/notifications/:id
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const notification = await Notification.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()
    if (!notification) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    await notification.delete()
    return response.ok({ success: true, message: 'Đã xóa thông báo.' })
  }

  /**
   * DELETE /api/notifications/clear-all
   */
  async clearAll({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    await Notification.query().where('user_id', user.id).delete()
    return response.ok({ success: true, message: 'Đã xóa tất cả thông báo.' })
  }

  /** Serialize ra response đúng format (field `read` không dùng isRead) */
  private serialize(n: Notification) {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link ?? undefined,
      read: n.read,
      createdAt: n.createdAt.toISO(),
    }
  }
}
