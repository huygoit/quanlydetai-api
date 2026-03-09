import { DateTime } from 'luxon'
import User from '#models/user'
import Role from '#models/role'
import UserRoleAssignment from '#models/user_role_assignment'

export interface UserRoleDto {
  assignmentId: number
  roleId: number
  roleCode: string
  roleName: string
  isActive: boolean
  startAt: string | null
  endAt: string | null
}

/**
 * Service gán role cho user.
 */
export default class UserRoleAssignmentService {
  static async getUserRoles(userId: number): Promise<UserRoleDto[]> {
    const user = await User.find(userId)
    if (!user) throw new Error('USER_NOT_FOUND')

    const assignments = await UserRoleAssignment.query()
      .where('user_id', userId)
      .preload('role')
      .orderBy('id', 'asc')

    return assignments.map((a) => ({
      assignmentId: a.id,
      roleId: a.roleId,
      roleCode: a.role.code,
      roleName: a.role.name,
      isActive: a.isActive,
      startAt: a.startAt?.toISO() ?? null,
      endAt: a.endAt?.toISO() ?? null,
    }))
  }

  static async syncUserRoles(userId: number, roleIds: number[]): Promise<UserRoleDto[]> {
    const user = await User.find(userId)
    if (!user) throw new Error('USER_NOT_FOUND')

    for (const rid of roleIds) {
      const role = await Role.find(rid)
      if (!role) throw new Error('ROLE_NOT_FOUND')
    }

    await UserRoleAssignment.query().where('user_id', userId).delete()
    const ids = [...new Set(roleIds)]
    for (const rid of ids) {
      await UserRoleAssignment.create({
        userId,
        roleId: rid,
        isActive: true,
      })
    }
    return this.getUserRoles(userId)
  }

  private static parseDateTime(v: unknown): DateTime | null {
    if (v == null) return null
    if (v instanceof DateTime) return v
    if (typeof v === 'string') {
      const d = DateTime.fromISO(v)
      return d.isValid ? d : null
    }
    return null
  }

  static async assignRole(
    userId: number,
    payload: { roleId: number; isActive?: boolean; startAt?: unknown; endAt?: unknown }
  ): Promise<UserRoleDto> {
    const user = await User.find(userId)
    if (!user) throw new Error('USER_NOT_FOUND')

    const role = await Role.find(payload.roleId)
    if (!role) throw new Error('ROLE_NOT_FOUND')

    const existing = await UserRoleAssignment.query()
      .where('user_id', userId)
      .where('role_id', payload.roleId)
      .first()
    if (existing) throw new Error('ASSIGNMENT_EXISTS')

    const assignment = await UserRoleAssignment.create({
      userId,
      roleId: payload.roleId,
      isActive: payload.isActive ?? true,
      startAt: this.parseDateTime(payload.startAt),
      endAt: this.parseDateTime(payload.endAt),
    })
    await assignment.load('role')
    return {
      assignmentId: assignment.id,
      roleId: assignment.roleId,
      roleCode: assignment.role.code,
      roleName: assignment.role.name,
      isActive: assignment.isActive,
      startAt: assignment.startAt?.toISO() ?? null,
      endAt: assignment.endAt?.toISO() ?? null,
    }
  }

  static async updateAssignmentStatus(
    userId: number,
    assignmentId: number,
    isActive: boolean
  ): Promise<UserRoleDto> {
    const assignment = await UserRoleAssignment.query()
      .where('id', assignmentId)
      .where('user_id', userId)
      .preload('role')
      .first()
    if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND')

    assignment.isActive = isActive
    await assignment.save()

    return {
      assignmentId: assignment.id,
      roleId: assignment.roleId,
      roleCode: assignment.role.code,
      roleName: assignment.role.name,
      isActive: assignment.isActive,
      startAt: assignment.startAt?.toISO() ?? null,
      endAt: assignment.endAt?.toISO() ?? null,
    }
  }
}
