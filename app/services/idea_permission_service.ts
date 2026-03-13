import User from '#models/user'
import PermissionService from '#services/permission_service'

/**
 * Kiểm tra quyền ý tưởng - CHỈ dùng IAM permission.
 */
export default class IdeaPermissionService {
  /** Nhận sơ loại (receive) - idea.review */
  static async canReceiveIdea(user: User): Promise<boolean> {
    return PermissionService.userHasPermission(user.id, 'idea.review')
  }

  /** Duyệt sơ loại (approve-internal) - idea.review */
  static async canApproveInternalIdea(user: User): Promise<boolean> {
    return PermissionService.userHasPermission(user.id, 'idea.review')
  }

  /** Từ chối ý tưởng - idea.review hoặc idea.approve */
  static async canRejectIdea(user: User): Promise<boolean> {
    const hasReview = await PermissionService.userHasPermission(user.id, 'idea.review')
    if (hasReview) return true
    return PermissionService.userHasPermission(user.id, 'idea.approve')
  }

  /** Đề xuất đặt hàng (propose-order) - council.propose_order */
  static async canProposeOrder(user: User): Promise<boolean> {
    return PermissionService.userHasPermission(user.id, 'council.propose_order')
  }

  /** Phê duyệt đặt hàng (approve-order) - idea.approve */
  static async canApproveOrder(user: User): Promise<boolean> {
    return PermissionService.userHasPermission(user.id, 'idea.approve')
  }

  /** Tạo đề tài từ ý tưởng - council.create hoặc idea.approve */
  static async canCreateProjectFromIdea(user: User): Promise<boolean> {
    const hasCouncilCreate = await PermissionService.userHasPermission(user.id, 'council.create')
    if (hasCouncilCreate) return true
    return PermissionService.userHasPermission(user.id, 'idea.approve')
  }
}
