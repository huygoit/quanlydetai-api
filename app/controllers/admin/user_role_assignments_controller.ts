import type { HttpContext } from '@adonisjs/core/http'
import UserRoleAssignmentService from '#services/user_role_assignment_service'
import { assignUserRoleValidator } from '#validators/assign_user_role_validator'
import { syncUserRolesValidator } from '#validators/sync_user_roles_validator'
import { updateUserRoleAssignmentStatusValidator } from '#validators/update_user_role_assignment_status_validator'

/**
 * Admin: Gán role cho user.
 */
export default class AdminUserRoleAssignmentsController {
  async userRoles({ params, response }: HttpContext) {
    const userId = Number(params.userId)
    if (!Number.isFinite(userId)) {
      return response.badRequest({ success: false, message: 'User ID không hợp lệ.' })
    }
    try {
      const data = await UserRoleAssignmentService.getUserRoles(userId)
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

  async syncUserRoles({ params, request, response }: HttpContext) {
    const userId = Number(params.userId)
    if (!Number.isFinite(userId)) {
      return response.badRequest({ success: false, message: 'User ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(syncUserRolesValidator)
    const roleIds = payload.roleIds ?? []
    try {
      const data = await UserRoleAssignmentService.syncUserRoles(userId, roleIds)
      return response.ok({
        message: 'User roles updated successfully',
        data,
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy role.' })
      }
      throw err
    }
  }

  async assignRole({ params, request, response }: HttpContext) {
    const userId = Number(params.userId)
    if (!Number.isFinite(userId)) {
      return response.badRequest({ success: false, message: 'User ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(assignUserRoleValidator)
    try {
      const data = await UserRoleAssignmentService.assignRole(userId, {
        roleId: payload.roleId,
        isActive: payload.isActive,
        startAt: payload.startAt,
        endAt: payload.endAt,
      })
      return response.created({
        message: 'Role assigned successfully',
        data,
      })
    } catch (err) {
      if ((err as Error).message === 'USER_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy user.' })
      }
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy role.' })
      }
      if ((err as Error).message === 'ASSIGNMENT_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'User đã được gán role này.',
        })
      }
      throw err
    }
  }

  async changeAssignmentStatus({ params, request, response }: HttpContext) {
    const userId = Number(params.userId)
    const assignmentId = Number(params.assignmentId)
    if (!Number.isFinite(userId) || !Number.isFinite(assignmentId)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateUserRoleAssignmentStatusValidator)
    try {
      const data = await UserRoleAssignmentService.updateAssignmentStatus(
        userId,
        assignmentId,
        payload.isActive
      )
      return response.ok({
        message: 'Assignment status updated successfully',
        data,
      })
    } catch (err) {
      if ((err as Error).message === 'ASSIGNMENT_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy assignment.' })
      }
      throw err
    }
  }
}
