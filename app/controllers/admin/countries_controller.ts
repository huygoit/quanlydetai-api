import type { HttpContext } from '@adonisjs/core/http'
import type Country from '#models/country'
import CountryService from '#services/country_service'
import {
  createCountryValidator,
  updateCountryValidator,
  updateCountryStatusValidator,
} from '#validators/country_validator'

/** Admin CRUD danh mục quốc gia. */
export default class AdminCountriesController {
  private serialize(c: Country) {
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      display_order: c.displayOrder,
      status: c.status,
      created_at: c.createdAt?.toISO() ?? null,
      updated_at: c.updatedAt?.toISO() ?? null,
    }
  }

  async index({ request, response }: HttpContext) {
    const paginated = await CountryService.paginate({
      page: request.input('page', 1),
      perPage: request.input('perPage', 20),
      keyword: request.input('keyword', '') || undefined,
      status: request.input('status', '') || undefined,
      sortBy: request.input('sortBy', '') || undefined,
      order: request.input('order', 'asc') === 'desc' ? 'desc' : 'asc',
    })
    return response.ok({
      success: true,
      data: paginated.all().map((c) => this.serialize(c)),
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createCountryValidator)
    try {
      const item = await CountryService.create(payload)
      return response.created({ success: true, data: this.serialize(item) })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({ success: false, message: 'Mã quốc gia đã tồn tại.' })
      }
      throw err
    }
  }

  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateCountryValidator)
    try {
      const item = await CountryService.update(id, payload)
      return response.ok({ success: true, data: this.serialize(item) })
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'COUNTRY_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy quốc gia.' })
      }
      if (msg === 'CODE_EXISTS') {
        return response.unprocessableEntity({ success: false, message: 'Mã quốc gia đã tồn tại.' })
      }
      throw err
    }
  }

  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateCountryStatusValidator)
    try {
      const item = await CountryService.changeStatus(id, payload.status)
      return response.ok({ success: true, data: this.serialize(item) })
    } catch (err) {
      if ((err as Error).message === 'COUNTRY_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy quốc gia.' })
      }
      throw err
    }
  }
}
