import Role from '#models/role'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'
import UserRoleAssignment from '#models/user_role_assignment'

/** Role hệ thống dành cho người mới đăng ký - không được đổi tên/code */
export const BASIC_ROLE_CODE = 'BASIC'

/** Quyền mặc định cho role Basic */
const DEFAULT_PERMISSION_CODES = [
  'profile.view_own',
  'profile.update_own',
  'idea.view',
  'idea.create',
  'idea.update',
  'idea.submit',
  'idea.delete',
]

/**
 * Service quản lý role Basic - role hệ thống cho người mới đăng ký.
 */
export default class BasicRoleService {
  /**
   * Lấy hoặc tạo role Basic, đồng bộ quyền mặc định.
   */
  static async getOrCreateBasicRole(): Promise<Role> {
    let role = await Role.query().where('code', BASIC_ROLE_CODE).first()
    if (!role) {
      role = await Role.create({
        code: BASIC_ROLE_CODE,
        name: 'Người dùng cơ bản',
        description: 'Role mặc định cho người mới đăng ký. Có thể thêm/bớt quyền, không đổi tên.',
        status: 'ACTIVE',
      })
      const perms = await Permission.query()
        .whereIn('code', DEFAULT_PERMISSION_CODES)
        .where('status', 'ACTIVE')
      for (const p of perms) {
        await RolePermission.create({ roleId: role.id, permissionId: p.id })
      }
    }
    return role
  }

  /**
   * Gán role Basic cho user.
   */
  static async assignBasicRoleToUser(userId: number): Promise<void> {
    const role = await this.getOrCreateBasicRole()
    const exists = await UserRoleAssignment.query()
      .where('user_id', userId)
      .where('role_id', role.id)
      .first()
    if (exists) return
    await UserRoleAssignment.create({
      userId,
      roleId: role.id,
      isActive: true,
    })
  }

  /** Kiểm tra role có phải Basic (hệ thống) không */
  static isBasicRole(role: Role | { code: string }): boolean {
    return role.code === BASIC_ROLE_CODE
  }
}
