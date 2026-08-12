import type { HttpContext } from '@adonisjs/core/http'
import type ProjectProcessType from '#models/project_process_type'
import ProjectProcessTypeService from '#services/project_process_type_service'
import { projectProcessTypeCatalogQueryValidator } from '#validators/project_process_type_catalog_validator'

/**
 * Catalog cấp ý tưởng/đề tài — đọc, chỉ cần đăng nhập.
 */
export default class ProjectProcessTypesController {
  private serializeItem(row: ProjectProcessType) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      display_order: row.displayOrder,
      status: row.status,
    }
  }

  private serializeOption(row: ProjectProcessType) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
    }
  }

  async index({ request, response }: HttpContext) {
    const query = await request.validateUsing(projectProcessTypeCatalogQueryValidator, {
      data: request.qs(),
    })
    const paginated = await ProjectProcessTypeService.paginateCatalog({
      status: query.status ?? 'ACTIVE',
      keyword: query.keyword,
      page: query.page ?? 1,
      perPage: query.perPage ?? 500,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })
    return response.ok({
      success: true,
      data: paginated.all().map((r) => this.serializeItem(r)),
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  async options({ request, response }: HttpContext) {
    const query = await request.validateUsing(projectProcessTypeCatalogQueryValidator, {
      data: request.qs(),
    })
    const rows = await ProjectProcessTypeService.listCatalogOptions({
      status: query.status ?? 'ACTIVE',
      keyword: query.keyword,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })
    return response.ok({
      success: true,
      data: rows.map((r) => this.serializeOption(r)),
    })
  }

  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const row = await ProjectProcessTypeService.findActiveById(id)
      return response.ok({ success: true, data: this.serializeItem(row) })
    } catch (err) {
      if ((err as Error).message === 'PROJECT_PROCESS_TYPE_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Không tìm thấy cấp ý tưởng/đề tài.',
        })
      }
      throw err
    }
  }
}
