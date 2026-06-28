import type { HttpContext } from '@adonisjs/core/http'
import type Specialization from '#models/specialization'
import SpecializationService from '#services/specialization_service'
import { specializationCatalogQueryValidator } from '#validators/specialization_catalog_validator'

/**
 * Catalog chuyên ngành (đọc): dùng chung toàn hệ thống, chỉ cần đăng nhập.
 */
export default class SpecializationsController {
  /** Chuẩn hóa bản ghi catalog — snake_case theo spec FE */
  private serializeCatalogItem(s: Specialization) {
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      display_order: s.displayOrder,
      status: s.status,
    }
  }

  /** Payload gọn cho Select */
  private serializeCatalogOption(s: Specialization) {
    return {
      id: s.id,
      code: s.code,
      name: s.name,
    }
  }

  /** Đọc và validate query string (GET). */
  private async parseCatalogQuery(request: HttpContext['request']) {
    return request.validateUsing(specializationCatalogQueryValidator, {
      data: request.qs(),
    })
  }

  /** GET /api/specializations */
  async index({ request, response }: HttpContext) {
    const query = await this.parseCatalogQuery(request)

    const paginated = await SpecializationService.paginateCatalog({
      status: query.status ?? 'ACTIVE',
      keyword: query.keyword,
      page: query.page ?? 1,
      perPage: query.perPage ?? 500,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })

    const data = paginated.all().map((s) => this.serializeCatalogItem(s))

    return response.ok({
      success: true,
      message: 'Specializations fetched successfully',
      data,
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /** GET /api/specializations/options */
  async options({ request, response }: HttpContext) {
    const query = await this.parseCatalogQuery(request)

    const rows = await SpecializationService.listCatalogOptions({
      status: query.status ?? 'ACTIVE',
      keyword: query.keyword,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })

    return response.ok({
      success: true,
      data: rows.map((s) => this.serializeCatalogOption(s)),
    })
  }

  /** GET /api/specializations/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    try {
      const item = await SpecializationService.findActiveById(id)
      return response.ok({
        success: true,
        message: 'Specialization fetched successfully',
        data: this.serializeCatalogItem(item),
      })
    } catch (err) {
      if ((err as Error).message === 'SPECIALIZATION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy chuyên ngành.' })
      }
      throw err
    }
  }
}
