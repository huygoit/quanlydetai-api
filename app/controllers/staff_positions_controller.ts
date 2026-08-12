import type { HttpContext } from '@adonisjs/core/http'
import type StaffPosition from '#models/staff_position'
import StaffPositionService from '#services/staff_position_service'
import { staffPositionCatalogQueryValidator } from '#validators/staff_position_catalog_validator'

/**
 * Catalog chức vụ (đọc): dùng chung, chỉ cần đăng nhập.
 * Lọc theo kind để đổ Select từng loại trên form nhân sự.
 */
export default class StaffPositionsController {
  private serializeCatalogItem(row: StaffPosition) {
    return {
      id: row.id,
      kind: row.kind,
      code: row.code,
      name: row.name,
      display_order: row.displayOrder,
      status: row.status,
    }
  }

  private serializeCatalogOption(row: StaffPosition) {
    return {
      id: row.id,
      kind: row.kind,
      code: row.code,
      name: row.name,
    }
  }

  private async parseCatalogQuery(request: HttpContext['request']) {
    return request.validateUsing(staffPositionCatalogQueryValidator, {
      data: request.qs(),
    })
  }

  /** GET /api/staff-positions */
  async index({ request, response }: HttpContext) {
    const query = await this.parseCatalogQuery(request)

    const paginated = await StaffPositionService.paginateCatalog({
      kind: query.kind,
      status: query.status ?? 'ACTIVE',
      keyword: query.keyword,
      page: query.page ?? 1,
      perPage: query.perPage ?? 500,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })

    return response.ok({
      success: true,
      message: 'Staff positions fetched successfully',
      data: paginated.all().map((r) => this.serializeCatalogItem(r)),
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /** GET /api/staff-positions/options */
  async options({ request, response }: HttpContext) {
    const query = await this.parseCatalogQuery(request)

    const rows = await StaffPositionService.listCatalogOptions({
      kind: query.kind,
      status: query.status ?? 'ACTIVE',
      keyword: query.keyword,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })

    return response.ok({
      success: true,
      data: rows.map((r) => this.serializeCatalogOption(r)),
    })
  }

  /** GET /api/staff-positions/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    try {
      const item = await StaffPositionService.findActiveById(id)
      return response.ok({
        success: true,
        message: 'Staff position fetched successfully',
        data: this.serializeCatalogItem(item),
      })
    } catch (err) {
      if ((err as Error).message === 'STAFF_POSITION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy chức vụ.' })
      }
      throw err
    }
  }
}
