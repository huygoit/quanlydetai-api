import type { HttpContext } from '@adonisjs/core/http'
import type Department from '#models/department'
import DepartmentService from '#services/department_service'
import { departmentCatalogQueryValidator } from '#validators/department_catalog_validator'

/**
 * Catalog đơn vị (đọc): dùng chung toàn hệ thống, chỉ cần đăng nhập.
 */
export default class DepartmentsController {
  /** Chuẩn hóa bản ghi catalog — snake_case theo spec FE */
  private serializeCatalogItem(d: Department) {
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      short_name: d.shortName ?? null,
      type: d.type,
      display_order: d.displayOrder,
      status: d.status,
    }
  }

  /** Payload gọn cho Select */
  private serializeCatalogOption(d: Department) {
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      short_name: d.shortName ?? null,
      type: d.type,
    }
  }

  /** Đọc và validate query string (GET). */
  private async parseCatalogQuery(request: HttpContext['request']) {
    return request.validateUsing(departmentCatalogQueryValidator, {
      data: request.qs(),
    })
  }

  /** GET /api/departments */
  async index({ request, response }: HttpContext) {
    const query = await this.parseCatalogQuery(request)

    const paginated = await DepartmentService.paginateCatalog({
      status: query.status ?? 'ACTIVE',
      type: query.type,
      scope: query.scope ?? 'all',
      keyword: query.keyword,
      page: query.page ?? 1,
      perPage: query.perPage ?? 500,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })

    const data = paginated.all().map((d) => this.serializeCatalogItem(d))

    return response.ok({
      success: true,
      message: 'Departments fetched successfully',
      data,
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /** GET /api/departments/options */
  async options({ request, response }: HttpContext) {
    const query = await this.parseCatalogQuery(request)

    const rows = await DepartmentService.listCatalogOptions({
      status: query.status ?? 'ACTIVE',
      type: query.type,
      scope: query.scope ?? 'all',
      keyword: query.keyword,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })

    return response.ok({
      success: true,
      data: rows.map((d) => this.serializeCatalogOption(d)),
    })
  }

  /** GET /api/departments/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    try {
      const dept = await DepartmentService.findActiveById(id)
      return response.ok({
        success: true,
        message: 'Department fetched successfully',
        data: this.serializeCatalogItem(dept),
      })
    } catch (err) {
      if ((err as Error).message === 'DEPARTMENT_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy đơn vị.' })
      }
      throw err
    }
  }
}
