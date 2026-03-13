import User from '#models/user'
import PermissionService from '#services/permission_service'

/**
 * Kiểm tra quyền quản lý phiên hội đồng - CHỈ dùng IAM permission.
 */
export default class CouncilPermissionService {
  static async canManageCouncil(user: User): Promise<boolean> {
    const hasCreate = await PermissionService.userHasPermission(user.id, 'council.create')
    if (hasCreate) return true
    return PermissionService.userHasPermission(user.id, 'council.view')
  }
}
