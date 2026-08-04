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
    // Màn phân quyền vai trò cần tải đủ catalog — cho phép tối đa 1000
    const perPage = Math.min(Math.max(1, Number(filters.perPage) || 10), 1000)
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
    q.orderBy(col, order === 'desc' ? 'desc' : 'asc').orderBy('code', 'asc')

    return q.paginate(page, perPage)
  }

  /** Toàn bộ quyền (không phân trang) — dùng màn phân quyền vai trò */
  static async listAll(filters: { status?: string; module?: string } = {}): Promise<Permission[]> {
    const q = Permission.query().orderBy('module', 'asc').orderBy('code', 'asc')
    if (filters.status) q.where('status', filters.status)
    if (filters.module) q.where('module', filters.module)
    return q
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
   * Bổ sung quyền chuẩn còn thiếu — Admin sync / seeder dùng chung.
   * Chỉ tạo nếu chưa tồn tại. Module 3: cfp.*, project.*, selection.*
   */
  static readonly STANDARD_MISSING: Array<{ code: string; name: string; module: string; action: string }> = [
    { code: 'profile.view_own', name: 'Xem hồ sơ của mình', module: 'profile', action: 'view_own' },
    { code: 'profile.update_own', name: 'Cập nhật hồ sơ của mình', module: 'profile', action: 'update_own' },
    { code: 'idea.view', name: 'Xem ý tưởng', module: 'idea', action: 'view' },
    { code: 'idea.create', name: 'Tạo ý tưởng', module: 'idea', action: 'create' },
    { code: 'idea.update', name: 'Cập nhật ý tưởng', module: 'idea', action: 'update' },
    { code: 'idea.submit', name: 'Gửi ý tưởng', module: 'idea', action: 'submit' },
    { code: 'idea.delete', name: 'Xóa ý tưởng', module: 'idea', action: 'delete' },
    // US-03-01 — Thông báo tuyển chọn (CFP)
    { code: 'cfp.view', name: 'Xem thông báo tuyển chọn', module: 'cfp', action: 'view' },
    { code: 'cfp.create', name: 'Tạo thông báo tuyển chọn', module: 'cfp', action: 'create' },
    { code: 'cfp.update', name: 'Sửa thông báo tuyển chọn', module: 'cfp', action: 'update' },
    { code: 'cfp.submit', name: 'Trình duyệt thông báo tuyển chọn', module: 'cfp', action: 'submit' },
    { code: 'cfp.approve', name: 'Duyệt / trả về thông báo tuyển chọn', module: 'cfp', action: 'approve' },
    { code: 'cfp.publish', name: 'Phát hành thông báo tuyển chọn', module: 'cfp', action: 'publish' },
    { code: 'cfp.extend', name: 'Gia hạn kỳ nộp hồ sơ', module: 'cfp', action: 'extend' },
    { code: 'cfp.close', name: 'Đóng sớm kỳ nộp hồ sơ', module: 'cfp', action: 'close' },
    // US-03-02 / 03-03 — Đề xuất đề tài
    { code: 'project.view', name: 'Xem đề xuất / đề tài', module: 'project', action: 'view' },
    { code: 'project.create', name: 'Tạo đề xuất đề tài', module: 'project', action: 'create' },
    { code: 'project.update', name: 'Cập nhật đề xuất đề tài', module: 'project', action: 'update' },
    { code: 'project.submit', name: 'Nộp đề xuất đề tài', module: 'project', action: 'submit' },
    {
      code: 'project.assign_reviewer',
      name: 'Khoa xác nhận / trả lại đề xuất',
      module: 'project',
      action: 'assign_reviewer',
    },
    { code: 'project.review', name: 'PKH kiểm tra / tổng hợp đề xuất', module: 'project', action: 'review' },
    { code: 'project.approve', name: 'BGH phê duyệt đề xuất / danh mục', module: 'project', action: 'approve' },
    { code: 'project.acceptance', name: 'Nghiệm thu đề tài', module: 'project', action: 'acceptance' },
    { code: 'project.liquidation', name: 'Thanh lý / tài chính đề tài', module: 'project', action: 'liquidation' },
    // US-03-04 — Phiên xét chọn
    {
      code: 'project.selection_manage',
      name: 'Quản lý phiên xét chọn đề tài (nhập kết quả, biên bản, trình BGH)',
      module: 'project',
      action: 'selection_manage',
    },
    {
      code: 'project.selection_approve',
      name: 'BGH phê duyệt danh mục xét chọn đề tài',
      module: 'project',
      action: 'selection_approve',
    },
    // US-03-05 — Gia hạn điều chỉnh (PKH)
    {
      code: 'project.adjustment_extend',
      name: 'Gia hạn điều chỉnh đề xuất theo yêu cầu Hội đồng',
      module: 'project',
      action: 'adjustment_extend',
    },
    {
      code: 'project_process_type.view',
      name: 'Xem danh mục loại quy trình đề tài',
      module: 'project_process_type',
      action: 'view',
    },
    {
      code: 'project_process_type.create',
      name: 'Tạo loại quy trình đề tài',
      module: 'project_process_type',
      action: 'create',
    },
    {
      code: 'project_process_type.update',
      name: 'Cập nhật loại quy trình đề tài',
      module: 'project_process_type',
      action: 'update',
    },
    {
      code: 'project_process_type.delete',
      name: 'Xóa loại quy trình đề tài',
      module: 'project_process_type',
      action: 'delete',
    },
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
      } else if (exists.name !== p.name) {
        exists.name = p.name
        await exists.save()
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
   * Khớp code chính xác, hoặc wildcard module.* / * trên role, hoặc SUPER_ADMIN.
   */
  static async getUserIdsWithPermission(permissionCode: string): Promise<number[]> {
    const [module] = permissionCode.split('.')
    const matchingPerms = await Permission.query()
      .where('status', 'ACTIVE')
      .where((q) => {
        q.where('code', permissionCode)
          .orWhere('code', `${module}.*`)
          .orWhere('code', '*')
          .orWhere('code', 'all')
      })

    const permIds = matchingPerms.map((p) => p.id)
    let rids: number[] = []
    if (permIds.length) {
      const rolePermRows = await RolePermission.query().whereIn('permission_id', permIds)
      rids = [...new Set(rolePermRows.map((r) => r.roleId))]
    }

    const superAdminRole = await Role.query().where('code', 'SUPER_ADMIN').first()
    if (superAdminRole) rids = [...new Set([...rids, superAdminRole.id])]
    if (!rids.length) return []

    const assignments = await UserRoleAssignment.query()
      .whereIn('role_id', rids)
      .where('is_active', true)
      .select('user_id')
    const userIds = [...new Set(assignments.map((a) => a.userId))]
    if (!userIds.length) return []

    const activeUsers = await User.query().whereIn('id', userIds).where('is_active', true).select('id')
    return activeUsers.map((u) => u.id)
  }

  /** Hợp các userId có ít nhất một trong các permission (thông báo đa quyền). */
  static async getUserIdsWithAnyPermission(permissionCodes: string[]): Promise<number[]> {
    const set = new Set<number>()
    for (const code of permissionCodes) {
      const ids = await this.getUserIdsWithPermission(code)
      for (const id of ids) set.add(id)
    }
    return [...set]
  }
}
