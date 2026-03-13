import Permission from '#models/permission'
import User from '#models/user'
import Role from '#models/role'
import UserRoleAssignment from '#models/user_role_assignment'
import RolePermission from '#models/role_permission'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { PermissionStatus } from '#models/permission'

export interface PermissionFilters {
  page?: number
  perPage?: number
  keyword?: string
  module?: string
  status?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

/**
 * Service quản lý permissions và kiểm tra quyền user.
 */
export default class PermissionService {
  static async paginate(filters: PermissionFilters = {}): Promise<ModelPaginatorContract<Permission>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 10, 100)
    const sortBy = filters.sortBy ?? 'module'
    const order = filters.order ?? 'asc'

    const q = Permission.query()
    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`).orWhereILike('name', `%${filters.keyword}%`)
      })
    }
    if (filters.module) q.where('module', filters.module)
    if (filters.status) q.where('status', filters.status)

    const validSort = ['code', 'name', 'module', 'action', 'status', 'created_at']
    const col = validSort.includes(sortBy) ? sortBy : 'module'
    q.orderBy(col, order === 'desc' ? 'desc' : 'asc')

    return q.paginate(page, perPage)
  }

  static async findById(id: number): Promise<Permission> {
    const perm = await Permission.find(id)
    if (!perm) throw new Error('PERMISSION_NOT_FOUND')
    return perm
  }

  static async isCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const q = Permission.query().where('code', code)
    if (excludeId != null) q.whereNot('id', excludeId)
    const existing = await q.first()
    return !!existing
  }

  static async create(payload: {
    code: string
    name: string
    module: string
    action: string
    description?: string | null
    status?: PermissionStatus
  }): Promise<Permission> {
    if (await this.isCodeExists(payload.code)) throw new Error('CODE_EXISTS')
    return Permission.create({
      code: payload.code,
      name: payload.name,
      module: payload.module,
      action: payload.action,
      description: payload.description ?? null,
      status: payload.status ?? 'ACTIVE',
    })
  }

  static async update(
    id: number,
    payload: {
      code?: string
      name?: string
      module?: string
      action?: string
      description?: string | null
      status?: PermissionStatus
    }
  ): Promise<Permission> {
    const perm = await this.findById(id)
    if (payload.code !== undefined) {
      if (await this.isCodeExists(payload.code, id)) throw new Error('CODE_EXISTS')
      perm.code = payload.code
    }
    if (payload.name !== undefined) perm.name = payload.name
    if (payload.module !== undefined) perm.module = payload.module
    if (payload.action !== undefined) perm.action = payload.action
    if (payload.description !== undefined) perm.description = payload.description ?? null
    if (payload.status !== undefined) perm.status = payload.status
    await perm.save()
    return perm
  }

  /**
   * Bổ sung các quyền chuẩn còn thiếu (profile, idea cơ bản).
   * Chỉ tạo nếu chưa tồn tại. Trả về số quyền đã thêm.
   */
  static readonly STANDARD_MISSING: Array<{ code: string; name: string; module: string; action: string }> = [
    { code: 'profile.view_own', name: 'Xem hồ sơ của mình', module: 'profile', action: 'view_own' },
    { code: 'profile.update_own', name: 'Cập nhật hồ sơ của mình', module: 'profile', action: 'update_own' },
    { code: 'idea.view', name: 'Xem ý tưởng', module: 'idea', action: 'view' },
    { code: 'idea.create', name: 'Tạo ý tưởng', module: 'idea', action: 'create' },
    { code: 'idea.update', name: 'Cập nhật ý tưởng', module: 'idea', action: 'update' },
    { code: 'idea.submit', name: 'Gửi ý tưởng', module: 'idea', action: 'submit' },
    { code: 'idea.delete', name: 'Xóa ý tưởng', module: 'idea', action: 'delete' },
  ]

  static async syncMissingStandardPermissions(): Promise<{ added: number; permissions: Permission[] }> {
    const added: Permission[] = []
    for (const p of this.STANDARD_MISSING) {
      const exists = await Permission.query().where('code', p.code).first()
      if (!exists) {
        const perm = await Permission.create({
          code: p.code,
          name: p.name,
          module: p.module,
          action: p.action,
          description: null,
          status: 'ACTIVE',
        })
        added.push(perm)
      }
    }
    return { added: added.length, permissions: added }
  }

  static async updateStatus(id: number, status: PermissionStatus): Promise<Permission> {
    const perm = await this.findById(id)
    perm.status = status
    await perm.save()
    return perm
  }

  /**
   * Lấy danh sách permission codes mà user có (từ các role active).
   * SUPER_ADMIN có tất cả quyền (trả về ['*']).
   */
  static async getUserPermissions(userId: number): Promise<string[]> {
    const assignments = await UserRoleAssignment.query()
      .where('user_id', userId)
      .where('is_active', true)
      .preload('role', (q) => q.where('status', 'ACTIVE'))

    const hasSuperAdmin = assignments.some((a) => a.role?.code === 'SUPER_ADMIN')
    if (hasSuperAdmin) return ['*']

    const roleIds = assignments.map((a) => a.roleId).filter(Boolean)
    if (roleIds.length === 0) return []

    const rows = await RolePermission.query()
      .whereIn('role_id', roleIds)
      .preload('permission', (q) => q.where('status', 'ACTIVE'))

    const codes = new Set<string>()
    for (const r of rows) {
      if (r.permission?.code) codes.add(r.permission.code)
    }
    return [...codes]
  }

  /**
   * Lấy danh sách role codes mà user có (assignments active).
   */
  static async getUserRoles(userId: number): Promise<string[]> {
    const assignments = await UserRoleAssignment.query()
      .where('user_id', userId)
      .where('is_active', true)
      .preload('role', (q) => q.where('status', 'ACTIVE'))
    return assignments.map((a) => a.role?.code).filter((c): c is string => !!c)
  }

  /**
   * Kiểm tra user có permission code không.
   */
  static async userHasPermission(userId: number, permissionCode: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId)
    if (perms.includes('*') || perms.includes('all')) return true
    if (perms.includes(permissionCode)) return true
    const [module] = permissionCode.split('.')
    if (perms.includes(`${module}.*`)) return true
    return false
  }

  /**
   * Lấy danh sách userId có permission (dùng cho thông báo theo quyền).
   */
  static async getUserIdsWithPermission(permissionCode: string): Promise<number[]> {
    const perm = await Permission.query().where('code', permissionCode).first()
    if (!perm) return []

    const rolePermRows = await RolePermission.query().where('permission_id', perm.id)
    let rids = [...new Set(rolePermRows.map((r) => r.roleId))]

    const superAdminRole = await Role.query().where('code', 'SUPER_ADMIN').first()
    if (superAdminRole) rids = [...new Set([...rids, superAdminRole.id])]

    const assignments = await UserRoleAssignment.query()
      .whereIn('role_id', rids)
      .where('is_active', true)
      .select('user_id')
    const userIds = [...new Set(assignments.map((a) => a.userId))]

    const activeUsers = await User.query().whereIn('id', userIds).where('is_active', true).select('id')
    return activeUsers.map((u) => u.id)
  }
}
