import type { HttpContext } from '@adonisjs/core/http'
import type University from '#models/university'
import UniversityService from '#services/university_service'
import {
  UNIVERSITY_REGION_LABELS,
  UNIVERSITY_SCHOOL_BLOCK_LABELS,
  type UniversityRegion,
  type UniversitySchoolBlock,
} from '#types/university'
import {
  createUniversityValidator,
  updateUniversityValidator,
  updateUniversityStatusValidator,
} from '#validators/university_validator'

/** Admin CRUD danh mục trường đại học. */
export default class AdminUniversitiesController {
  private serialize(
    u: University,
    countryMap: Map<number, { id: number; code: string; name: string }>
  ) {
    const country = u.countryId ? countryMap.get(u.countryId) : null
    return {
      id: u.id,
      code: u.code,
      name: u.name,
      region: u.region,
      region_label: UNIVERSITY_REGION_LABELS[u.region as UniversityRegion] ?? u.region,
      school_block: u.schoolBlock,
      school_block_label:
        UNIVERSITY_SCHOOL_BLOCK_LABELS[u.schoolBlock as UniversitySchoolBlock] ?? u.schoolBlock,
      country_id: u.countryId != null ? Number(u.countryId) : null,
      country: country
        ? { id: Number(country.id), code: country.code, name: country.name }
        : null,
      is_private: u.isPrivate,
      display_order: u.displayOrder,
      status: u.status,
      created_at: u.createdAt?.toISO() ?? null,
      updated_at: u.updatedAt?.toISO() ?? null,
    }
  }

  async index({ request, response }: HttpContext) {
    const countryIdRaw = request.input('countryId', request.input('country_id', ''))
    const countryId = countryIdRaw ? Number(countryIdRaw) : undefined
    const paginated = await UniversityService.paginate({
      page: request.input('page', 1),
      perPage: request.input('perPage', 20),
      keyword: request.input('keyword', '') || undefined,
      status: request.input('status', '') || undefined,
      region: request.input('region', '') || undefined,
      schoolBlock: request.input('schoolBlock', '') || request.input('school_block', '') || undefined,
      countryId: Number.isFinite(countryId) ? countryId : undefined,
      sortBy: request.input('sortBy', '') || undefined,
      order: request.input('order', 'asc') === 'desc' ? 'desc' : 'asc',
    })
    const rows = paginated.all()
    const countryMap = await UniversityService.mapCountriesByIds(
      rows.map((u) => u.countryId).filter((id): id is number => id != null)
    )
    return response.ok({
      success: true,
      data: rows.map((u) => this.serialize(u, countryMap)),
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createUniversityValidator)
    try {
      const item = await UniversityService.create(payload)
      const countryMap = await UniversityService.mapCountriesByIds(
        item.countryId ? [item.countryId] : []
      )
      return response.created({ success: true, data: this.serialize(item, countryMap) })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({ success: false, message: 'Mã trường đã tồn tại.' })
      }
      throw err
    }
  }

  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateUniversityValidator)
    try {
      const item = await UniversityService.update(id, payload)
      const countryMap = await UniversityService.mapCountriesByIds(
        item.countryId ? [item.countryId] : []
      )
      return response.ok({ success: true, data: this.serialize(item, countryMap) })
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'UNIVERSITY_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy trường.' })
      }
      if (msg === 'CODE_EXISTS') {
        return response.unprocessableEntity({ success: false, message: 'Mã trường đã tồn tại.' })
      }
      throw err
    }
  }

  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateUniversityStatusValidator)
    try {
      const item = await UniversityService.changeStatus(id, payload.status)
      const countryMap = await UniversityService.mapCountriesByIds(
        item.countryId ? [item.countryId] : []
      )
      return response.ok({ success: true, data: this.serialize(item, countryMap) })
    } catch (err) {
      if ((err as Error).message === 'UNIVERSITY_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy trường.' })
      }
      throw err
    }
  }
}
