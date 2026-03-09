import Role from '#models/role'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { RoleStatus } from '#models/role'

export interface RoleFilters {
  page?: number
  perPage?: number
  keyword?: string
  status?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

/**
 * Service quản lý roles.
 */
export default class RoleService {
  static async paginate(filters: RoleFilters = {}): Promise<ModelPaginatorContract<Role>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 10, 100)
    const sortBy = filters.sortBy ?? 'code'
    const order = filters.order ?? 'asc'

    const q = Role.query()
    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('code', `%${filters.keyword}%`).orWhereILike('name', `%${filters.keyword}%`)
      })
    }
    if (filters.status) q.where('status', filters.status)

    const validSort = ['code', 'name', 'status', 'created_at']
    const col = validSort.includes(sortBy) ? sortBy : 'code'
    q.orderBy(col, order === 'desc' ? 'desc' : 'asc')

    return q.paginate(page, perPage)
  }

  static async findById(id: number): Promise<Role> {
    const role = await Role.find(id)
    if (!role) throw new Error('ROLE_NOT_FOUND')
    return role
  }

  static async isCodeExists(code: string, excludeId?: number): Promise<boolean> {
    const q = Role.query().where('code', code)
    if (excludeId != null) q.whereNot('id', excludeId)
    const existing = await q.first()
    return !!existing
  }

  static async create(payload: { code: string; name: string; description?: string | null; status?: RoleStatus }): Promise<Role> {
    if (await this.isCodeExists(payload.code)) throw new Error('CODE_EXISTS')
    return Role.create({
      code: payload.code,
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status ?? 'ACTIVE',
    })
  }

  static async update(
    id: number,
    payload: { code?: string; name?: string; description?: string | null; status?: RoleStatus }
  ): Promise<Role> {
    const role = await this.findById(id)
    if (payload.code !== undefined) {
      if (await this.isCodeExists(payload.code, id)) throw new Error('CODE_EXISTS')
      role.code = payload.code
    }
    if (payload.name !== undefined) role.name = payload.name
    if (payload.description !== undefined) role.description = payload.description ?? null
    if (payload.status !== undefined) role.status = payload.status
    await role.save()
    return role
  }

  static async updateStatus(id: number, status: RoleStatus): Promise<Role> {
    const role = await this.findById(id)
    role.status = status
    await role.save()
    return role
  }

  static async getPermissions(roleId: number): Promise<Permission[]> {
    await this.findById(roleId)
    const role = await Role.query()
      .where('id', roleId)
      .preload('permissions', (q) => q.where('permissions.status', 'ACTIVE'))
      .firstOrFail()
    return role.permissions
  }

  static async syncPermissions(roleId: number, permissionIds: number[]): Promise<{ roleId: number; permissionIds: number[] }> {
    await this.findById(roleId)
    await RolePermission.query().where('role_id', roleId).delete()
    const ids = [...new Set(permissionIds)]
    for (const pid of ids) {
      await RolePermission.create({ roleId, permissionId: pid })
    }
    return { roleId, permissionIds: ids }
  }
}
