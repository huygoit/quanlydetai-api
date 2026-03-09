import User from '#models/user'
import PermissionService from '#services/permission_service'
import UserRoleAssignment from '#models/user_role_assignment'

export interface MeRoleDto {
  id: number
  code: string
  name: string
}

export interface MeDepartmentDto {
  id: number
  code: string
  name: string
  type: string
}

export interface MeDataDto {
  id: number
  username: string
  email: string
  fullName: string
  phone: string | null
  status: string
  departmentId: number | null
  department: MeDepartmentDto | null
  roles: MeRoleDto[]
  permissions: string[]
}

/**
 * Service xây dựng dữ liệu GET /api/auth/me cho access control.
 */
export default class AuthProfileService {
  static async getMeData(user: User): Promise<MeDataDto> {
    await user.load('department')

    const assignments = await UserRoleAssignment.query()
      .where('user_id', user.id)
      .where('is_active', true)
      .preload('role', (q) => q.where('status', 'ACTIVE'))

    const roles: MeRoleDto[] = assignments
      .filter((a) => a.role)
      .map((a) => ({
        id: a.role!.id,
        code: a.role!.code,
        name: a.role!.name,
      }))

    const permissions = await PermissionService.getUserPermissions(user.id)
    const permissionList = permissions.includes('*')
      ? permissions
      : [...new Set(permissions)]

    const dept = user.department
    const department: MeDepartmentDto | null = dept
      ? {
          id: dept.id,
          code: dept.code,
          name: dept.name,
          type: dept.type,
        }
      : null

    return {
      id: user.id,
      username: user.email.split('@')[0] ?? user.email,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      departmentId: user.departmentId ?? null,
      department,
      roles,
      permissions: permissionList,
    }
  }
}
