import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import IamUserService from '#services/iam_user_service'
import UserRoleAssignmentService from '#services/user_role_assignment_service'
import { createIamUserValidator } from '#validators/create_iam_user_validator'
import { updateIamUserValidator } from '#validators/update_iam_user_validator'
import { updateIamUserStatusValidator } from '#validators/update_iam_user_status_validator'
import { resetIamUserPasswordValidator } from '#validators/reset_iam_user_password_validator'
import { assignUserRolesIamValidator } from '#validators/assign_user_roles_iam_validator'
import { assignUserRoleValidator } from '#validators/assign_user_role_validator'
import { updateUserRoleAssignmentStatusValidator } from '#validators/update_user_role_assignment_status_validator'

/**
 * Admin: Quản lý user IAM (danh sách, chi tiết, tạo, cập nhật, reset password, gán role).
 */
export default class AdminIamUsersController {
  private serializeUserListItem(
    user: User,
    rolesMap: Map<number, { id: number; code: string; name: string }[]>
  ) {
    const dept = user.department
    const roles = rolesMap.get(user.id) ?? []
    return {
      id: user.id,
      fullName: user.fullName,
      full_name: user.fullName,
      email: user.email,
      phone: user.phone ?? null,
      department: dept ? { id: dept.id, name: dept.name, code: dept.code } : null,
      roles,
      isActive: user.isActive,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      lastLoginAt: user.lastLoginAt?.toISO() ?? null,
      createdAt: user.createdAt.toISO(),
      updatedAt: user.updatedAt?.toISO() ?? null,
    }
  }

  private serializeUserDetail(user: User) {
    const dept = user.department
    const roles = (user.roleAssignments ?? []).map((a) => ({
      id: a.role!.id,
      code: a.role!.code,
      name: a.role!.name,
      isActive: a.isActive,
    }))
    return {
      id: user.id,
      fullName: user.fullName,
      full_name: user.fullName,
      email: user.email,
      phone: user.phone ?? null,
      department: dept ? { id: dept.id, name: dept.name, code: dept.code } : null,
      roles,
      unit: user.unit ?? null,
      isActive: user.isActive,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      note: user.note ?? null,
      lastLoginAt: user.lastLoginAt?.toISO() ?? null,
      createdAt: user.createdAt.toISO(),
      updatedAt: user.updatedAt?.toISO() ?? null,
    }
  }

  async index({ request, response }: HttpContext) {
    const departmentId = request.input('departmentId')
    const roleId = request.input('roleId')
    const isActiveRaw = request.input('isActive')
    let isActive: boolean | undefined
    if (isActiveRaw === '' || isActiveRaw === undefined || isActiveRaw === null) {
      isActive = undefined
    } else {
      isActive = isActiveRaw === 'true' || isActiveRaw === '1'
    }

    const paginated = await IamUserService.paginate({
      page: request.input('page', 1),
      perPage: request.input('perPage') ?? request.input('per_page', 10),
      keyword: request.input('keyword', ''),
      departmentId: departmentId ? Number(departmentId) : undefined,
      roleId: roleId ? Number(roleId) : undefined,
      isActive,
      sortBy: request.input('sortBy', ''),
      order: (request.input('order', 'desc') as 'asc' | 'desc') || 'desc',
    })

    const users = paginated.all()
    const userIds = users.map((u) => u.id)
    const rolesMap = await UserRoleAssignmentService.getRolesByUserIds(userIds)
    const data = users.map((u) => this.serializeUserListItem(u, rolesMap))
    return response.ok({
      message: 'Users fetched successfully',
      data,
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const user = await IamUserService.findById(id)
      return response.ok({
        message: 'User fetched successfully',
        data: this.serializeUserDetail(user),
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      throw err
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createIamUserValidator)
    try {
      const user = await IamUserService.create({
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone ?? null,
        departmentId: payload.departmentId ?? null,
        password: payload.password,
        roleIds: payload.roleIds ?? [],
        isActive: payload.isActive ?? true,
        note: payload.note ?? null,
      })
      return response.created({
        message: 'User created successfully',
        data: this.serializeUserDetail(user),
      })
    } catch (err) {
      if ((err as Error).message === 'EMAIL_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Email đã tồn tại.',
        })
      }
      if ((err as Error).message === 'DEPARTMENT_NOT_FOUND') {
        return response.unprocessableEntity({
          success: false,
          message: 'Không tìm thấy đơn vị.',
        })
      }
      throw err
    }
  }

  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateIamUserValidator)
    try {
      const user = await IamUserService.update(id, {
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        departmentId: payload.departmentId,
        isActive: payload.isActive,
        note: payload.note,
      })
      return response.ok({
        message: 'User updated successfully',
        data: this.serializeUserDetail(user),
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      if ((err as Error).message === 'EMAIL_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Email đã tồn tại.',
        })
      }
      if ((err as Error).message === 'DEPARTMENT_NOT_FOUND') {
        return response.unprocessableEntity({
          success: false,
          message: 'Không tìm thấy đơn vị.',
        })
      }
      throw err
    }
  }

  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateIamUserStatusValidator)
    try {
      const user = await IamUserService.changeStatus(id, payload.isActive)
      return response.ok({
        message: 'User status updated successfully',
        data: this.serializeUserDetail(user),
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      throw err
    }
  }

  async resetPassword({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(resetIamUserPasswordValidator)
    try {
      await IamUserService.resetPassword(id, payload.password)
      return response.ok({
        message: 'Password reset successfully',
        data: null,
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      throw err
    }
  }

  async roles({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const data = await IamUserService.getRoles(id)
      return response.ok({
        message: 'User roles fetched successfully',
        data,
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      throw err
    }
  }

  async assignRoles({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(assignUserRolesIamValidator)
    const roleIds = payload.roleIds ?? payload.role_ids ?? []
    try {
      const data = await IamUserService.assignRoles(id, roleIds)
      return response.ok({
        message: 'User roles updated successfully',
        data,
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.unprocessableEntity({
          success: false,
          message: 'Một hoặc nhiều role không tồn tại.',
        })
      }
      throw err
    }
  }

  /** POST /api/admin/users/:id/roles - Gán thêm 1 role */
  async addRole({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(assignUserRoleValidator)
    const roleId = payload.roleId ?? payload.role_id
    if (roleId == null) {
      return response.badRequest({ success: false, message: 'roleId hoặc role_id bắt buộc.' })
    }
    try {
      const data = await IamUserService.addRole(id, {
        roleId,
        isActive: payload.isActive ?? payload.is_active ?? true,
        startAt: payload.startAt ?? payload.start_at,
        endAt: payload.endAt ?? payload.end_at,
      })
      const serialized = {
        id: data.assignmentId,
        assignmentId: data.assignmentId,
        roleId: data.roleId,
        role_id: data.roleId,
        roleCode: data.roleCode,
        roleName: data.roleName,
        role: { id: data.roleId, code: data.roleCode, name: data.roleName },
        isActive: data.isActive,
        is_active: data.isActive,
        startAt: data.startAt,
        start_at: data.startAt,
        endAt: data.endAt,
        end_at: data.endAt,
      }
      return response.created({
        message: 'Role assigned successfully',
        data: serialized,
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.unprocessableEntity({ success: false, message: 'Không tìm thấy role.' })
      }
      if ((err as Error).message === 'ASSIGNMENT_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'User đã có role này.',
        })
      }
      throw err
    }
  }

  /** PATCH /api/admin/users/:id/roles/:assignmentId/status */
  async updateAssignmentStatus({ params, request, response }: HttpContext) {
    const userId = Number(params.id)
    const assignmentId = Number(params.assignmentId)
    if (!Number.isFinite(userId) || !Number.isFinite(assignmentId)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateUserRoleAssignmentStatusValidator)
    const isActive = payload.isActive ?? payload.is_active
    if (typeof isActive !== 'boolean') {
      return response.badRequest({ success: false, message: 'isActive hoặc is_active bắt buộc.' })
    }
    try {
      const data = await IamUserService.updateAssignmentStatus(userId, assignmentId, isActive)
      const serialized = {
        id: data.assignmentId,
        assignmentId: data.assignmentId,
        roleId: data.roleId,
        role_id: data.roleId,
        roleCode: data.roleCode,
        roleName: data.roleName,
        role: { id: data.roleId, code: data.roleCode, name: data.roleName },
        isActive: data.isActive,
        is_active: data.isActive,
        startAt: data.startAt,
        start_at: data.startAt,
        endAt: data.endAt,
        end_at: data.endAt,
      }
      return response.ok({
        success: true,
        message: 'Assignment status updated successfully',
        data: serialized,
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      if ((err as Error).message === 'ASSIGNMENT_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy assignment.' })
      }
      throw err
    }
  }

  /** DELETE /api/admin/users/:id/roles/:assignmentId */
  async removeRole({ params, response }: HttpContext) {
    const userId = Number(params.id)
    const assignmentId = Number(params.assignmentId)
    if (!Number.isFinite(userId) || !Number.isFinite(assignmentId)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const data = await IamUserService.removeRole(userId, assignmentId)
      return response.ok({
        message: 'Role removed successfully',
        data,
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      if ((err as Error).message === 'ASSIGNMENT_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy assignment.' })
      }
      throw err
    }
  }
}
