import type { HttpContext } from '@adonisjs/core/http'
import type Specialization from '#models/specialization'
import SpecializationService from '#services/specialization_service'
import { createSpecializationValidator } from '#validators/create_specialization_validator'
import { updateSpecializationValidator } from '#validators/update_specialization_validator'
import { updateSpecializationStatusValidator } from '#validators/update_specialization_status_validator'

/**
 * Admin: CRUD quản lý danh mục chuyên ngành (specialization).
 */
export default class AdminSpecializationsController {
  /** Chuẩn hóa cho response — snake_case theo spec FE */
  private serialize(s: Specialization) {
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      display_order: s.displayOrder,
      status: s.status,
      created_at: s.createdAt?.toISO() ?? null,
      updated_at: s.updatedAt?.toISO() ?? null,
    }
  }

  /** GET /api/admin/specializations */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 20)
    const keyword = request.input('keyword', '')
    const status = request.input('status', '')
    const sortBy = request.input('sortBy', '')
    const order = request.input('order', 'asc')

    const paginated = await SpecializationService.paginate({
      page,
      perPage,
      keyword: keyword || undefined,
      status: status || undefined,
      sortBy: sortBy || undefined,
      order: order === 'desc' ? 'desc' : 'asc',
    })

    const data = paginated.all().map((s) => this.serialize(s))

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

  /** GET /api/admin/specializations/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const item = await SpecializationService.findById(id)
      return response.ok({
        success: true,
        message: 'Specialization fetched successfully',
        data: this.serialize(item),
      })
    } catch (err) {
      if ((err as Error).message === 'SPECIALIZATION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy chuyên ngành.' })
      }
      throw err
    }
  }

  /** POST /api/admin/specializations */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createSpecializationValidator)

    try {
      const item = await SpecializationService.create({
        code: payload.code,
        name: payload.name,
        displayOrder: payload.displayOrder ?? 0,
        status: payload.status ?? 'ACTIVE',
      })
      return response.created({
        success: true,
        message: 'Specialization created successfully',
        data: this.serialize(item),
      })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã chuyên ngành đã tồn tại.',
        })
      }
      throw err
    }
  }

  /** PUT /api/admin/specializations/:id */
  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const payload = await request.validateUsing(updateSpecializationValidator)

    try {
      const item = await SpecializationService.update(id, {
        code: payload.code,
        name: payload.name,
        displayOrder: payload.displayOrder,
        status: payload.status,
      })
      return response.ok({
        success: true,
        message: 'Specialization updated successfully',
        data: this.serialize(item),
      })
    } catch (err) {
      if ((err as Error).message === 'SPECIALIZATION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy chuyên ngành.' })
      }
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã chuyên ngành đã tồn tại.',
        })
      }
      throw err
    }
  }

  /** PATCH /api/admin/specializations/:id/status */
  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const payload = await request.validateUsing(updateSpecializationStatusValidator)

    try {
      const item = await SpecializationService.updateStatus(id, payload.status)
      return response.ok({
        success: true,
        message: 'Specialization status updated successfully',
        data: this.serialize(item),
      })
    } catch (err) {
      if ((err as Error).message === 'SPECIALIZATION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy chuyên ngành.' })
      }
      throw err
    }
  }
}
