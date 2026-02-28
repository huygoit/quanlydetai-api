import type { HttpContext } from '@adonisjs/core/http'
import Catalog from '#models/catalog'
import AuditLogService from '#services/audit_log_service'
import { createCatalogValidator } from '#validators/catalog_validator'
import { updateCatalogValidator } from '#validators/catalog_validator'

/**
 * Controller danh mục: CRUD admin + API public lấy theo type.
 */
export default class CatalogsController {
  /**
   * GET /api/admin/catalogs
   * Query: type, isActive, keyword, page, perPage
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const type = request.input('type', '')
    const isActive = request.input('isActive', '')
    const keyword = request.input('keyword', '')

    const q = Catalog.query().orderBy('sort_order', 'asc').orderBy('id', 'asc')

    if (type) q.where('type', type)
    if (isActive !== '') {
      const active = isActive === 'true' || isActive === '1'
      q.where('is_active', active)
    }
    if (keyword) {
      q.where((builder) => {
        builder
          .whereILike('code', `%${keyword}%`)
          .orWhereILike('name', `%${keyword}%`)
      })
    }

    const paginated = await q.paginate(page, perPage)
    const data = paginated.all().map((c) => this.serializeCatalog(c))
    return response.ok({
      success: true,
      data,
      meta: {
        total: paginated.total,
        currentPage: paginated.currentPage,
        perPage: paginated.perPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /**
   * GET /api/admin/catalogs/:id
   */
  async show({ params, response }: HttpContext) {
    const catalog = await Catalog.find(params.id)
    if (!catalog) {
      return response.notFound({ success: false, message: 'Không tìm thấy danh mục.' })
    }
    return response.ok({ success: true, data: this.serializeCatalog(catalog) })
  }

  /**
   * POST /api/admin/catalogs
   */
  async store(ctx: HttpContext) {
    const { request, response } = ctx
    const payload = await request.validateUsing(createCatalogValidator)
    const existing = await Catalog.query()
      .where('type', payload.type)
      .where('code', payload.code)
      .first()
    if (existing) {
      return response.badRequest({
        success: false,
        message: 'Đã tồn tại danh mục cùng type và code.',
        errors: [{ field: 'code', message: 'Code đã tồn tại cho type này.' }],
      })
    }
    const catalog = await Catalog.create({
      type: payload.type,
      code: payload.code,
      name: payload.name,
      description: payload.description ?? null,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
      parentId: payload.parentId ?? null,
      metadata: payload.metadata ?? null,
    })
    await AuditLogService.logCreate('CATALOG', String(catalog.id), this.serializeCatalog(catalog), ctx)
    return response.created({ success: true, data: this.serializeCatalog(catalog) })
  }

  /**
   * PUT /api/admin/catalogs/:id
   */
  async update(ctx: HttpContext) {
    const { params, request, response } = ctx
    const catalog = await Catalog.find(params.id)
    if (!catalog) {
      return response.notFound({ success: false, message: 'Không tìm thấy danh mục.' })
    }
    const payload = await request.validateUsing(updateCatalogValidator)
    const oldData = this.serializeCatalog(catalog)

    if (payload.type !== undefined) catalog.type = payload.type
    if (payload.code !== undefined) catalog.code = payload.code
    if (payload.name !== undefined) catalog.name = payload.name
    if (payload.description !== undefined) catalog.description = payload.description ?? null
    if (payload.sortOrder !== undefined) catalog.sortOrder = payload.sortOrder
    if (payload.isActive !== undefined) catalog.isActive = payload.isActive
    if (payload.parentId !== undefined) catalog.parentId = payload.parentId ?? null
    if (payload.metadata !== undefined) catalog.metadata = payload.metadata ?? null

    await catalog.save()
    await AuditLogService.logUpdate(
      'CATALOG',
      String(catalog.id),
      oldData,
      this.serializeCatalog(catalog),
      ctx
    )
    return response.ok({ success: true, data: this.serializeCatalog(catalog) })
  }

  /**
   * DELETE /api/admin/catalogs/:id
   * Soft delete: set isActive = false
   */
  async destroy(ctx: HttpContext) {
    const { params, response } = ctx
    const catalog = await Catalog.find(params.id)
    if (!catalog) {
      return response.notFound({ success: false, message: 'Không tìm thấy danh mục.' })
    }
    const oldData = this.serializeCatalog(catalog)
    catalog.isActive = false
    await catalog.save()
    await AuditLogService.logDelete('CATALOG', String(catalog.id), oldData, ctx)
    return response.ok({ success: true, message: 'Đã vô hiệu hóa danh mục.' })
  }

  /**
   * GET /api/catalogs/by-type/:type (PUBLIC - không cần auth)
   * Chỉ trả về isActive = true, dùng cho dropdown.
   */
  async byType({ params, response }: HttpContext) {
    const list = await Catalog.query()
      .where('type', params.type)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    const data = list.map((c) => ({ code: c.code, name: c.name }))
    return response.ok({ success: true, data })
  }

  private serializeCatalog(c: Catalog) {
    return {
      id: c.id,
      type: c.type,
      code: c.code,
      name: c.name,
      description: c.description ?? undefined,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      parentId: c.parentId ?? undefined,
      metadata: c.metadata ?? undefined,
      createdAt: c.createdAt.toISO(),
      updatedAt: c.updatedAt.toISO(),
    }
  }
}
