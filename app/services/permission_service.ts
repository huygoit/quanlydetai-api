import Permission from '#models/permission'
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
}
