import type { HttpContext } from '@adonisjs/core/http'
import type Field from '#models/field'
import FieldService from '#services/field_service'
import { fieldCatalogQueryValidator } from '#validators/field_catalog_validator'

/**
 * Catalog lĩnh vực (đọc): dùng chung toàn hệ thống, chỉ cần đăng nhập.
 */
export default class FieldsController {
  /** Chuẩn hóa bản ghi catalog — snake_case theo spec FE */
  private serializeCatalogItem(f: Field) {
    return {
      id: f.id,
      code: f.code,
      name: f.name,
      display_order: f.displayOrder,
      status: f.status,
    }
  }

  /** Payload gọn cho Select */
  private serializeCatalogOption(f: Field) {
    return {
      id: f.id,
      code: f.code,
      name: f.name,
    }
  }

  /** Đọc và validate query string (GET). */
  private async parseCatalogQuery(request: HttpContext['request']) {
    return request.validateUsing(fieldCatalogQueryValidator, {
      data: request.qs(),
    })
  }

  /** GET /api/fields */
  async index({ request, response }: HttpContext) {
    const query = await this.parseCatalogQuery(request)

    const paginated = await FieldService.paginateCatalog({
      status: query.status ?? 'ACTIVE',
      keyword: query.keyword,
      page: query.page ?? 1,
      perPage: query.perPage ?? 500,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })

    const data = paginated.all().map((f) => this.serializeCatalogItem(f))

    return response.ok({
      success: true,
      message: 'Fields fetched successfully',
      data,
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /** GET /api/fields/options */
  async options({ request, response }: HttpContext) {
    const query = await this.parseCatalogQuery(request)

    const rows = await FieldService.listCatalogOptions({
      status: query.status ?? 'ACTIVE',
      keyword: query.keyword,
      sortBy: query.sortBy ?? 'display_order',
      order: query.order ?? 'asc',
    })

    return response.ok({
      success: true,
      data: rows.map((f) => this.serializeCatalogOption(f)),
    })
  }

  /** GET /api/fields/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    try {
      const field = await FieldService.findActiveById(id)
      return response.ok({
        success: true,
        message: 'Field fetched successfully',
        data: this.serializeCatalogItem(field),
      })
    } catch (err) {
      if ((err as Error).message === 'FIELD_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy lĩnh vực.' })
      }
      throw err
    }
  }
}
