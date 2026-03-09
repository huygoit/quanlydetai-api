import Notification from '#models/notification'
import User from '#models/user'

/**
 * Service gửi thông báo để các module khác gọi (push, pushMany, pushToRole, các trigger).
 */
export default class NotificationService {
  /**
   * Gửi thông báo đến 1 user
   */
  static async push(
    userId: number,
    data: { type: string; title: string; message: string; link?: string }
  ) {
    return await Notification.create({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link ?? null,
    })
  }

  /**
   * Gửi thông báo đến nhiều users
   */
  static async pushMany(
    userIds: number[],
    data: { type: string; title: string; message: string; link?: string }
  ) {
    const rows = userIds.map((userId) => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link ?? null,
    }))
    return await Notification.createMany(rows)
  }

  /**
   * Gửi thông báo đến tất cả users có role nhất định
   */
  static async pushToRole(
    role: string,
    data: { type: string; title: string; message: string; link?: string }
  ) {
    const users = await User.query().where('role', role).where('is_active', true)
    const userIds = users.map((u) => u.id)
    if (userIds.length > 0) {
      return await this.pushMany(userIds, data)
    }
    return []
  }

  /**
   * Gửi thông báo đến nhiều roles
   */
  static async pushToRoles(
    roles: string[],
    data: { type: string; title: string; message: string; link?: string }
  ) {
    const users = await User.query().whereIn('role', roles).where('is_active', true)
    const userIds = users.map((u) => u.id)
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
   * Khi NCV submit ý tưởng (DRAFT → SUBMITTED) → thông báo PHONG_KH
   */
  static async notifyIdeaSubmitted(ideaCode: string, ideaTitle: string, ideaId: number, ownerName: string) {
    await this.pushToRole('PHONG_KH', {
      type: 'IDEA_SUBMITTED',
      title: 'Ý tưởng mới cần sơ loại',
      message: `${ownerName} đã gửi ý tưởng ${ideaCode}: ${ideaTitle}. Vui lòng xem xét sơ loại.`,
      link: `/ideas/review`,
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
    const statusLabel = statusLabels[newStatus] ?? newStatus

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
    const statusLabel = statusLabels[newStatus] ?? newStatus

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
    const users = await User.query().where('is_active', true)
    const userIds = users.map((u) => u.id)
    if (userIds.length > 0) {
      await this.pushMany(userIds, {
        type: 'SYSTEM',
        title,
        message,
      })
    }
  }
}
