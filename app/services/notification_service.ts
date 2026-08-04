import Notification from '#models/notification'
import User from '#models/user'
import PermissionService from '#services/permission_service'

type NotifyPayload = { type: string; title: string; message: string; link?: string }

/**
 * Service gửi thông báo in-app (chuông góc phải).
 * Broadcast nghiệp vụ buộc theo permission IAM — không theo cột users.role cứng.
 */
export default class NotificationService {
  /** Gửi thông báo đến 1 user */
  static async push(userId: number, data: NotifyPayload) {
    return await Notification.create({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link ?? null,
    })
  }

  /** Gửi thông báo đến nhiều users */
  static async pushMany(userIds: number[], data: NotifyPayload) {
    const unique = [...new Set(userIds.filter((id) => Number.isFinite(id)))]
    if (!unique.length) return []
    const rows = unique.map((userId) => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link ?? null,
    }))
    return await Notification.createMany(rows)
  }

  /**
   * Gửi thông báo đến mọi user có permission (IAM role_permissions).
   * Đây là API chuẩn thay cho pushToRole theo role cứng.
   */
  static async pushToPermission(permissionCode: string, data: NotifyPayload) {
    const userIds = await PermissionService.getUserIdsWithPermission(permissionCode)
    if (!userIds.length) return []
    return await this.pushMany(userIds, data)
  }

  /** Gửi đến user có ít nhất một trong các permission */
  static async pushToPermissions(permissionCodes: string[], data: NotifyPayload) {
    const userIds = await PermissionService.getUserIdsWithAnyPermission(permissionCodes)
    if (!userIds.length) return []
    return await this.pushMany(userIds, data)
  }

  /**
   * @deprecated Không dùng role cứng trên users.role.
   * Giữ stub để tránh gọi nhầm — chuyển sang pushToPermission.
   */
  static async pushToRole(
    _role: string,
    _data: NotifyPayload
  ): Promise<Notification[]> {
    console.warn(
      '[NotificationService.pushToRole] Đã ngưng dùng role cứng. Hãy gọi pushToPermission.'
    )
    return []
  }

  /**
   * @deprecated Không dùng role cứng trên users.role.
   */
  static async pushToRoles(
    _roles: string[],
    _data: NotifyPayload
  ): Promise<Notification[]> {
    console.warn(
      '[NotificationService.pushToRoles] Đã ngưng dùng role cứng. Hãy gọi pushToPermissions.'
    )
    return []
  }

  // ============ TRIGGER FUNCTIONS ============

  static async notifyProfileSubmitted(profileId: number, profileName: string) {
    await this.pushToPermission('profile.verify', {
      type: 'PROFILE_SUBMITTED',
      title: 'Hồ sơ mới cập nhật',
      message: `Hồ sơ khoa học của ${profileName} đã gửi cập nhật. Vui lòng xem xét.`,
      link: `/profile/${profileId}`,
    })
  }

  static async notifyProfileVerified(userId: number) {
    await this.push(userId, {
      type: 'PROFILE_VERIFIED',
      title: 'Hồ sơ đã được xác thực',
      message: 'Hồ sơ khoa học của bạn đã được Phòng KH xác thực thành công.',
      link: '/profile/me',
    })
  }

  static async notifyNeedMoreInfo(userId: number, reason: string) {
    await this.push(userId, {
      type: 'PROFILE_NEED_INFO',
      title: 'Yêu cầu bổ sung hồ sơ',
      message: `Hồ sơ khoa học cần bổ sung: ${reason}`,
      link: '/profile/me',
    })
  }

  static async notifyPublicationCorrectionRequested(
    userId: number,
    publicationId: number,
    publicationTitle: string,
    reason: string
  ) {
    await this.push(userId, {
      type: 'PUBLICATION_CORRECTION_REQUESTED',
      title: 'Yêu cầu hiệu chỉnh kết quả NCKH',
      message: `Kết quả NCKH "${publicationTitle}" cần hiệu chỉnh: ${reason}`,
      link: `/profile/me?tab=publications&pubId=${publicationId}`,
    })
  }

  static async notifyPublicationCorrected(
    publicationId: number,
    publicationTitle: string,
    ownerName: string
  ) {
    await this.pushToPermissions(['publication.review', 'publication.approve'], {
      type: 'PUBLICATION_CORRECTED',
      title: 'Kết quả NCKH đã hiệu chỉnh',
      message: `${ownerName} đã hiệu chỉnh kết quả NCKH "${publicationTitle}". Vui lòng kiểm tra.`,
      link: `/research-outputs/edit/${publicationId}`,
    })
  }

  static async notifyIdeaSubmitted(
    ideaCode: string,
    ideaTitle: string,
    ideaId: number,
    ownerName: string
  ) {
    await this.pushToPermission('idea.review', {
      type: 'IDEA_SUBMITTED',
      title: 'Ý tưởng mới cần sơ loại',
      message: `${ownerName} đã gửi ý tưởng ${ideaCode}: ${ideaTitle}. Vui lòng xem xét sơ loại.`,
      link: `/ideas/review`,
    })
  }

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

  static async notifyProjectProposalStatusChanged(
    userId: number,
    proposalCode: string,
    newStatus: string,
    proposalId: number
  ) {
    const statusLabels: Record<string, string> = {
      CHO_PKH: 'đã được Khoa xác nhận (chờ Phòng KH)',
      UNIT_REVIEWED: 'đã được Khoa xác nhận (chờ Phòng KH)',
      RETURNED: 'đã bị Khoa trả lại — vui lòng chỉnh sửa và gửi lại',
      HOP_LE: 'đã được PKH xác nhận hợp lệ',
      YEU_CAU_BS: 'cần bổ sung theo yêu cầu PKH — vui lòng cập nhật và gửi lại',
      YEU_CAU_BS_EXTENDED: 'đã được PKH gia hạn thời gian bổ sung',
      DA_LOAI: 'đã bị PKH loại',
      DUOC_CHON: 'đã được Hội đồng tuyển chọn — bạn có thể soạn thuyết minh',
      DIEU_CHINH: 'được đồng ý có điều chỉnh — vui lòng xem nội dung cần chỉnh sửa',
      KHONG_CHON: 'không được tuyển chọn trong kỳ này',
      APPROVED: 'đã được phê duyệt',
      REJECTED: 'không được phê duyệt',
    }
    const statusLabel = statusLabels[newStatus] ?? newStatus

    await this.push(userId, {
      type: 'PROJECT_UPDATE',
      title: `Đề xuất ${proposalCode}`,
      message: `Đề xuất ${proposalCode} của bạn ${statusLabel}.`,
      link: `/projects/register/form/${proposalId}`,
    })
  }

  /**
   * AC3: GV gửi lên Khoa → thông báo user có quyền Khoa (cùng đơn vị).
   */
  static async notifyUnitHeadsProposalSubmitted(proposal: {
    id: number
    code: string
    title: string
    ownerName: string
    ownerUnit: string
  }) {
    const headIds = await PermissionService.getUserIdsWithPermission('project.assign_reviewer')
    if (!headIds.length) return

    const heads = await User.query()
      .whereIn('id', headIds)
      .where('is_active', true)
      .where('unit', proposal.ownerUnit)

    const ids = heads.map((u) => u.id).filter((id) => id != null)
    if (!ids.length) return

    await this.pushMany(ids, {
      type: 'PROJECT_UPDATE',
      title: 'Đề xuất mới chờ Khoa xác nhận',
      message: `${proposal.ownerName} đã gửi đề xuất "${proposal.title}" (${proposal.code}).`,
      link: `/projects/register?id=${proposal.id}`,
    })
  }

  /** Khoa xác nhận → CHO_PKH: báo PKH (project.review) */
  static async notifyPkhProposalReady(proposal: {
    id: number
    code: string
    title: string
    ownerName: string
  }) {
    await this.pushToPermission('project.review', {
      type: 'PROJECT_UPDATE',
      title: 'Đề xuất chờ PKH kiểm tra',
      message: `${proposal.ownerName} — đề xuất "${proposal.title}" (${proposal.code}) đã được Khoa xác nhận.`,
      link: `/projects/pkh-review?id=${proposal.id}`,
    })
  }

  /** Trình BGH danh mục xét chọn */
  static async notifyBghSelectionPending(sessionId: number, sessionTitle: string) {
    await this.pushToPermissions(['project.selection_approve', 'project.approve'], {
      type: 'PROJECT_UPDATE',
      title: 'Danh mục xét chọn chờ BGH phê duyệt',
      message: `${sessionTitle} đã được trình BGH.`,
      link: `/projects/selection-sessions/${sessionId}`,
    })
  }

  /** Tạo phiên xét chọn → thông báo người có quyền quản lý phiên */
  static async notifySelectionSessionCreated(sessionId: number, message: string) {
    await this.pushToPermissions(['project.selection_manage', 'project.review'], {
      type: 'PROJECT_UPDATE',
      title: 'Phiên xét chọn đề tài mới',
      message,
      link: `/projects/selection-sessions/${sessionId}`,
    })
  }

  static async notifyCouncilSessionOpened(
    sessionId: number,
    sessionTitle: string,
    userIds: number[]
  ) {
    if (userIds.length === 0) return
    await this.pushMany(userIds, {
      type: 'COUNCIL_SESSION_OPENED',
      title: 'Phiên hội đồng đã mở',
      message: `${sessionTitle} đã mở. Xin vui lòng chấm điểm các ý tưởng!`,
      link: `/ideas/council/${sessionId}`,
    })
  }

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
