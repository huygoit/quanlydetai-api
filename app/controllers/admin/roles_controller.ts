import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import RoleService from '#services/role_service'
import { createRoleValidator } from '#validators/create_role_validator'
import { updateRoleValidator } from '#validators/update_role_validator'
import { updateRoleStatusValidator } from '#validators/update_role_status_validator'
import { syncRolePermissionsValidator } from '#validators/sync_role_permissions_validator'

/**
 * Admin: CRUD roles, gán permissions cho role.
 */
export default class AdminRolesController {
  private serializeRole(r: Role) {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description ?? null,
      status: r.status,
      createdAt: r.createdAt.toISO(),
      updatedAt: r.updatedAt?.toISO() ?? null,
    }
  }

  async index({ request, response }: HttpContext) {
    const paginated = await RoleService.paginate({
      page: request.input('page', 1),
      perPage: request.input('perPage', 10),
      keyword: request.input('keyword', ''),
      status: request.input('status', ''),
      sortBy: request.input('sortBy', 'code'),
      order: (request.input('order', 'asc') as 'asc' | 'desc') || 'asc',
    })
    const data = paginated.all().map((r) => this.serializeRole(r))
    return response.ok({
      message: 'Roles fetched successfully',
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
      const role = await RoleService.findById(id)
      return response.ok({
        message: 'Role fetched successfully',
        data: this.serializeRole(role),
      })
    } catch (err) {
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy role.' })
      }
      throw err
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createRoleValidator)
    try {
      const role = await RoleService.create({
        code: payload.code,
        name: payload.name,
        description: payload.description ?? null,
        status: payload.status ?? 'ACTIVE',
      })
      return response.created({
        message: 'Role created successfully',
        data: this.serializeRole(role),
      })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã role đã tồn tại.',
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
    const payload = await request.validateUsing(updateRoleValidator)
    try {
      const role = await RoleService.update(id, {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        status: payload.status,
      })
      return response.ok({
        message: 'Role updated successfully',
        data: this.serializeRole(role),
      })
    } catch (err) {
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy role.' })
      }
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã role đã tồn tại.',
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
    const payload = await request.validateUsing(updateRoleStatusValidator)
    try {
      const role = await RoleService.updateStatus(id, payload.status)
      return response.ok({
        message: 'Role status updated successfully',
        data: this.serializeRole(role),
      })
    } catch (err) {
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy role.' })
      }
      throw err
    }
  }

  async permissions({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const perms = await RoleService.getPermissions(id)
      const data = perms.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        module: p.module,
        action: p.action,
      }))
      return response.ok({
        message: 'Role permissions fetched successfully',
        data,
      })
    } catch (err) {
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy role.' })
      }
      throw err
    }
  }

  async syncPermissions({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(syncRolePermissionsValidator)
    const permissionIds = payload.permissionIds ?? payload.permission_ids ?? []
    try {
      const result = await RoleService.syncPermissions(id, permissionIds)
      return response.ok({
        message: 'Role permissions updated successfully',
        data: result,
      })
    } catch (err) {
      if ((err as Error).message === 'ROLE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy role.' })
      }
      throw err
    }
  }
}
