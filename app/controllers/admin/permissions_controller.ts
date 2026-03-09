import type { HttpContext } from '@adonisjs/core/http'
import Permission from '#models/permission'
import PermissionService from '#services/permission_service'
import { createPermissionValidator } from '#validators/create_permission_validator'
import { updatePermissionValidator } from '#validators/update_permission_validator'
import { updatePermissionStatusValidator } from '#validators/update_permission_status_validator'

/**
 * Admin: CRUD permissions.
 */
export default class AdminPermissionsController {
  private serializePermission(p: Permission) {
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      module: p.module,
      action: p.action,
      description: p.description ?? null,
      status: p.status,
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt?.toISO() ?? null,
    }
  }

  async index({ request, response }: HttpContext) {
    const paginated = await PermissionService.paginate({
      page: request.input('page', 1),
      perPage: request.input('perPage', 10),
      keyword: request.input('keyword', ''),
      module: request.input('module', ''),
      status: request.input('status', ''),
      sortBy: request.input('sortBy', ''),
      order: request.input('order', 'asc') as 'asc' | 'desc',
    })
    const data = paginated.all().map((p) => this.serializePermission(p))
    return response.ok({
      message: 'Permissions fetched successfully',
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
      const perm = await PermissionService.findById(id)
      return response.ok({
        message: 'Permission fetched successfully',
        data: this.serializePermission(perm),
      })
    } catch (err) {
      if ((err as Error).message === 'PERMISSION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy permission.' })
      }
      throw err
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createPermissionValidator)
    try {
      const perm = await PermissionService.create({
        code: payload.code,
        name: payload.name,
        module: payload.module,
        action: payload.action,
        description: payload.description ?? null,
        status: payload.status ?? 'ACTIVE',
      })
      return response.created({
        message: 'Permission created successfully',
        data: this.serializePermission(perm),
      })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã permission đã tồn tại.',
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
    const payload = await request.validateUsing(updatePermissionValidator)
    try {
      const perm = await PermissionService.update(id, {
        code: payload.code,
        name: payload.name,
        module: payload.module,
        action: payload.action,
        description: payload.description,
        status: payload.status,
      })
      return response.ok({
        message: 'Permission updated successfully',
        data: this.serializePermission(perm),
      })
    } catch (err) {
      if ((err as Error).message === 'PERMISSION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy permission.' })
      }
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã permission đã tồn tại.',
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
    const payload = await request.validateUsing(updatePermissionStatusValidator)
    try {
      const perm = await PermissionService.updateStatus(id, payload.status)
      return response.ok({
        message: 'Permission status updated successfully',
        data: this.serializePermission(perm),
      })
    } catch (err) {
      if ((err as Error).message === 'PERMISSION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy permission.' })
      }
      throw err
    }
  }
}
