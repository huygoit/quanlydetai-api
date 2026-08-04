import type { HttpContext } from '@adonisjs/core/http'
import type ProjectProcessType from '#models/project_process_type'
import ProjectProcessTypeService from '#services/project_process_type_service'
import { createProjectProcessTypeValidator } from '#validators/create_project_process_type_validator'
import { updateProjectProcessTypeValidator } from '#validators/update_project_process_type_validator'
import { updateProjectProcessTypeStatusValidator } from '#validators/update_project_process_type_status_validator'

/**
 * Admin CRUD — danh mục loại quy trình đề tài.
 */
export default class AdminProjectProcessTypesController {
  private serialize(row: ProjectProcessType) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      display_order: row.displayOrder,
      status: row.status,
      created_at: row.createdAt?.toISO() ?? null,
      updated_at: row.updatedAt?.toISO() ?? null,
    }
  }

  /** Chuẩn hóa displayOrder từ camelCase hoặc snake_case */
  private pickDisplayOrder(payload: Record<string, unknown>, request: HttpContext['request']) {
    const fromPayload = payload.displayOrder
    if (typeof fromPayload === 'number') return fromPayload
    const fromSnake = request.input('display_order')
    if (fromSnake !== undefined && fromSnake !== null && fromSnake !== '') {
      return Number(fromSnake)
    }
    return undefined
  }

  async index({ request, response }: HttpContext) {
    const paginated = await ProjectProcessTypeService.paginate({
      page: request.input('page', 1),
      perPage: request.input('perPage', 20),
      keyword: request.input('keyword', '') || undefined,
      status: request.input('status', '') || undefined,
      sortBy: request.input('sortBy', '') || undefined,
      order: request.input('order', 'asc') === 'desc' ? 'desc' : 'asc',
    })

    return response.ok({
      success: true,
      message: 'Project process types fetched successfully',
      data: paginated.all().map((r) => this.serialize(r)),
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
      const row = await ProjectProcessTypeService.findById(id)
      return response.ok({
        success: true,
        data: this.serialize(row),
      })
    } catch (err) {
      if ((err as Error).message === 'PROJECT_PROCESS_TYPE_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Không tìm thấy loại quy trình đề tài.',
        })
      }
      throw err
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createProjectProcessTypeValidator)
    try {
      const row = await ProjectProcessTypeService.create({
        code: payload.code,
        name: payload.name,
        description: payload.description,
        displayOrder: this.pickDisplayOrder(payload as unknown as Record<string, unknown>, request) ?? 0,
        status: payload.status ?? 'ACTIVE',
      })
      return response.created({
        success: true,
        message: 'Đã tạo loại quy trình đề tài',
        data: this.serialize(row),
      })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã loại quy trình đã tồn tại.',
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
    const payload = await request.validateUsing(updateProjectProcessTypeValidator)
    try {
      const displayOrder = this.pickDisplayOrder(
        payload as unknown as Record<string, unknown>,
        request
      )
      const row = await ProjectProcessTypeService.update(id, {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        displayOrder,
        status: payload.status,
      })
      return response.ok({
        success: true,
        message: 'Đã cập nhật loại quy trình đề tài',
        data: this.serialize(row),
      })
    } catch (err) {
      if ((err as Error).message === 'PROJECT_PROCESS_TYPE_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Không tìm thấy loại quy trình đề tài.',
        })
      }
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã loại quy trình đã tồn tại.',
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
    const payload = await request.validateUsing(updateProjectProcessTypeStatusValidator)
    try {
      const row = await ProjectProcessTypeService.updateStatus(id, payload.status)
      return response.ok({
        success: true,
        message: 'Đã cập nhật trạng thái',
        data: this.serialize(row),
      })
    } catch (err) {
      if ((err as Error).message === 'PROJECT_PROCESS_TYPE_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Không tìm thấy loại quy trình đề tài.',
        })
      }
      throw err
    }
  }
}
