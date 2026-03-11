import User from '#models/user'
import Department from '#models/department'
import UserRoleAssignment from '#models/user_role_assignment'
import UserRoleAssignmentService from '#services/user_role_assignment_service'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export interface IamUserFilters {
  page?: number
  perPage?: number
  keyword?: string
  departmentId?: number
  roleId?: number
  isActive?: boolean
  sortBy?: string
  order?: 'asc' | 'desc'
}

/**
 * Service quản lý user IAM.
 */
export default class IamUserService {
  static async paginate(filters: IamUserFilters = {}): Promise<ModelPaginatorContract<User>> {
    const page = filters.page ?? 1
    const perPage = Math.min(filters.perPage ?? 10, 100)
    const sortBy = filters.sortBy ?? 'id'
    const order = filters.order ?? 'desc'

    const q = User.query().preload('department')

    if (filters.keyword) {
      q.where((b) => {
        b.whereILike('full_name', `%${filters.keyword}%`)
          .orWhereILike('email', `%${filters.keyword}%`)
          .orWhereILike('phone', `%${filters.keyword}%`)
      })
    }
    if (filters.departmentId != null) q.where('department_id', filters.departmentId)
    if (filters.isActive !== undefined) q.where('is_active', filters.isActive)
    if (filters.roleId != null) {
      q.whereHas('roleAssignments', (aq) => {
        aq.where('role_id', filters.roleId!).where('is_active', true)
      })
    }

    const validSort = ['id', 'full_name', 'email', 'created_at']
    const col = validSort.includes(sortBy) ? sortBy : 'id'
    q.orderBy(col, order === 'desc' ? 'desc' : 'asc')

    return q.paginate(page, perPage)
  }

  static async findById(id: number): Promise<User> {
    const user = await User.query()
      .where('id', id)
      .preload('department')
      .preload('roleAssignments', (aq) => aq.preload('role').orderBy('id', 'asc'))
      .first()
    if (!user) throw new Error('USER_NOT_FOUND')
    return user
  }

  static async isEmailExists(email: string, excludeId?: number): Promise<boolean> {
    const q = User.query().whereRaw('LOWER(email) = ?', [email.toLowerCase()])
    if (excludeId != null) q.whereNot('id', excludeId)
    const existing = await q.first()
    return !!existing
  }

  static async create(payload: {
    fullName: string
    email: string
    phone?: string | null
    departmentId?: number | null
    password: string
    roleIds?: number[]
    isActive?: boolean
    note?: string | null
  }): Promise<User> {
    if (await this.isEmailExists(payload.email)) throw new Error('EMAIL_EXISTS')
    if (payload.departmentId != null) {
      const dept = await Department.find(payload.departmentId)
      if (!dept) throw new Error('DEPARTMENT_NOT_FOUND')
    }

    const user = await User.create({
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone ?? null,
      departmentId: payload.departmentId ?? null,
      password: payload.password,
      isActive: payload.isActive ?? true,
      note: payload.note ?? null,
      role: 'NCV', // legacy - giữ mặc định
      roleLabel: 'Nhà khoa học',
      unit: null,
    })

    const roleIds = payload.roleIds ?? []
    if (roleIds.length > 0) {
      await UserRoleAssignmentService.syncUserRoles(user.id, roleIds)
    }

    return this.findById(user.id)
  }

  static async update(
    id: number,
    payload: {
      fullName?: string
      email?: string
      phone?: string | null
      departmentId?: number | null
      isActive?: boolean
      note?: string | null
    }
  ): Promise<User> {
    const user = await this.findById(id)

    if (payload.email !== undefined) {
      if (await this.isEmailExists(payload.email, id)) throw new Error('EMAIL_EXISTS')
      user.email = payload.email
    }
    if (payload.fullName !== undefined) user.fullName = payload.fullName
    if (payload.phone !== undefined) user.phone = payload.phone ?? null
    if (payload.departmentId !== undefined) {
      if (payload.departmentId != null) {
        const dept = await Department.find(payload.departmentId)
        if (!dept) throw new Error('DEPARTMENT_NOT_FOUND')
      }
      user.departmentId = payload.departmentId ?? null
    }
    if (payload.isActive !== undefined) user.isActive = payload.isActive
    if (payload.note !== undefined) user.note = payload.note ?? null

    await user.save()
    return this.findById(id)
  }

  static async changeStatus(id: number, isActive: boolean): Promise<User> {
    const user = await this.findById(id)
    user.isActive = isActive
    await user.save()
    return this.findById(id)
  }

  static async resetPassword(id: number, password: string): Promise<User> {
    const user = await this.findById(id)
    user.password = password
    await user.save()
    return this.findById(id)
  }

  static async getRoles(userId: number) {
    return UserRoleAssignmentService.getUserRoles(userId)
  }

  static async assignRoles(userId: number, roleIds: number[]) {
    return UserRoleAssignmentService.syncUserRoles(userId, roleIds)
  }

  static async addRole(
    userId: number,
    payload: { roleId: number; isActive?: boolean; startAt?: unknown; endAt?: unknown }
  ) {
    return UserRoleAssignmentService.assignRole(userId, payload)
  }

  static async updateAssignmentStatus(userId: number, assignmentId: number, isActive: boolean) {
    return UserRoleAssignmentService.updateAssignmentStatus(userId, assignmentId, isActive)
  }

  static async removeRole(userId: number, assignmentId: number) {
    const assignment = await UserRoleAssignment.query()
      .where('user_id', userId)
      .where('id', assignmentId)
      .first()
    if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND')
    await assignment.delete()
    return UserRoleAssignmentService.getUserRoles(userId)
  }
}
