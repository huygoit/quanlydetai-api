import type { HttpContext } from '@adonisjs/core/http'
import type Field from '#models/field'
import FieldService from '#services/field_service'
import { createFieldValidator } from '#validators/create_field_validator'
import { updateFieldValidator } from '#validators/update_field_validator'
import { updateFieldStatusValidator } from '#validators/update_field_status_validator'

/**
 * Admin: CRUD quản lý danh mục lĩnh vực (field).
 */
export default class AdminFieldsController {
  /** Chuẩn hóa field cho response — snake_case theo spec FE */
  private serializeField(f: Field) {
    return {
      id: f.id,
      code: f.code,
      name: f.name,
      display_order: f.displayOrder,
      status: f.status,
      created_at: f.createdAt?.toISO() ?? null,
      updated_at: f.updatedAt?.toISO() ?? null,
    }
  }

  /** GET /api/admin/fields */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 20)
    const keyword = request.input('keyword', '')
    const status = request.input('status', '')
    const sortBy = request.input('sortBy', '')
    const order = request.input('order', 'asc')

    const paginated = await FieldService.paginate({
      page,
      perPage,
      keyword: keyword || undefined,
      status: status || undefined,
      sortBy: sortBy || undefined,
      order: order === 'desc' ? 'desc' : 'asc',
    })

    const data = paginated.all().map((f) => this.serializeField(f))

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

  /** GET /api/admin/fields/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const field = await FieldService.findById(id)
      return response.ok({
        success: true,
        message: 'Field fetched successfully',
        data: this.serializeField(field),
      })
    } catch (err) {
      if ((err as Error).message === 'FIELD_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy lĩnh vực.' })
      }
      throw err
    }
  }

  /** POST /api/admin/fields */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createFieldValidator)

    try {
      const field = await FieldService.create({
        code: payload.code,
        name: payload.name,
        displayOrder: payload.displayOrder ?? 0,
        status: payload.status ?? 'ACTIVE',
      })
      return response.created({
        success: true,
        message: 'Field created successfully',
        data: this.serializeField(field),
      })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã lĩnh vực đã tồn tại.',
        })
      }
      throw err
    }
  }

  /** PUT /api/admin/fields/:id */
  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const payload = await request.validateUsing(updateFieldValidator)

    try {
      const field = await FieldService.update(id, {
        code: payload.code,
        name: payload.name,
        displayOrder: payload.displayOrder,
        status: payload.status,
      })
      return response.ok({
        success: true,
        message: 'Field updated successfully',
        data: this.serializeField(field),
      })
    } catch (err) {
      if ((err as Error).message === 'FIELD_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy lĩnh vực.' })
      }
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã lĩnh vực đã tồn tại.',
        })
      }
      throw err
    }
  }

  /** PATCH /api/admin/fields/:id/status */
  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const payload = await request.validateUsing(updateFieldStatusValidator)

    try {
      const field = await FieldService.updateStatus(id, payload.status)
      return response.ok({
        success: true,
        message: 'Field status updated successfully',
        data: this.serializeField(field),
      })
    } catch (err) {
      if ((err as Error).message === 'FIELD_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy lĩnh vực.' })
      }
      throw err
    }
  }
}
