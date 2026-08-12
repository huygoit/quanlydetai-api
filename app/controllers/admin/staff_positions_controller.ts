import type { HttpContext } from '@adonisjs/core/http'
import type StaffPosition from '#models/staff_position'
import StaffPositionService from '#services/staff_position_service'
import { createStaffPositionValidator } from '#validators/create_staff_position_validator'
import { updateStaffPositionValidator } from '#validators/update_staff_position_validator'
import { updateStaffPositionStatusValidator } from '#validators/update_staff_position_status_validator'

/**
 * Admin: CRUD danh mục chức vụ nhân sự.
 */
export default class AdminStaffPositionsController {
  /** Chuẩn hóa response — snake_case theo FE */
  private serialize(row: StaffPosition) {
    return {
      id: row.id,
      kind: row.kind,
      code: row.code,
      name: row.name,
      display_order: row.displayOrder,
      status: row.status,
      created_at: row.createdAt?.toISO() ?? null,
      updated_at: row.updatedAt?.toISO() ?? null,
    }
  }

  /** Lấy displayOrder từ camelCase hoặc snake_case */
  private pickDisplayOrder(
    payload: Record<string, unknown>,
    request: HttpContext['request']
  ): number | undefined {
    const fromPayload = payload.displayOrder
    if (typeof fromPayload === 'number' && Number.isFinite(fromPayload)) return fromPayload
    const fromSnake = request.input('display_order')
    if (fromSnake !== undefined && fromSnake !== null && fromSnake !== '') {
      const n = Number(fromSnake)
      if (Number.isFinite(n)) return n
    }
    return undefined
  }

  /** GET /api/admin/staff-positions */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 20)
    const keyword = request.input('keyword', '')
    const status = request.input('status', '')
    const kind = request.input('kind', '')
    const sortBy = request.input('sortBy', '')
    const order = request.input('order', 'asc')

    const paginated = await StaffPositionService.paginate({
      page,
      perPage,
      keyword: keyword || undefined,
      status: status || undefined,
      kind: kind || undefined,
      sortBy: sortBy || undefined,
      order: order === 'desc' ? 'desc' : 'asc',
    })

    return response.ok({
      success: true,
      message: 'Staff positions fetched successfully',
      data: paginated.all().map((r) => this.serialize(r)),
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /** GET /api/admin/staff-positions/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const item = await StaffPositionService.findById(id)
      return response.ok({
        success: true,
        message: 'Staff position fetched successfully',
        data: this.serialize(item),
      })
    } catch (err) {
      if ((err as Error).message === 'STAFF_POSITION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy chức vụ.' })
      }
      throw err
    }
  }

  /** POST /api/admin/staff-positions */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createStaffPositionValidator)

    try {
      const item = await StaffPositionService.create({
        kind: payload.kind,
        code: payload.code,
        name: payload.name,
        displayOrder: this.pickDisplayOrder(payload as unknown as Record<string, unknown>, request) ?? 0,
        status: payload.status ?? 'ACTIVE',
      })
      return response.created({
        success: true,
        message: 'Staff position created successfully',
        data: this.serialize(item),
      })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã chức vụ đã tồn tại.',
        })
      }
      throw err
    }
  }

  /** PUT /api/admin/staff-positions/:id */
  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const payload = await request.validateUsing(updateStaffPositionValidator)

    try {
      const displayOrder = this.pickDisplayOrder(
        payload as unknown as Record<string, unknown>,
        request
      )
      const item = await StaffPositionService.update(id, {
        kind: payload.kind,
        code: payload.code,
        name: payload.name,
        displayOrder,
        status: payload.status,
      })
      return response.ok({
        success: true,
        message: 'Staff position updated successfully',
        data: this.serialize(item),
      })
    } catch (err) {
      if ((err as Error).message === 'STAFF_POSITION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy chức vụ.' })
      }
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã chức vụ đã tồn tại.',
        })
      }
      throw err
    }
  }

  /** PATCH /api/admin/staff-positions/:id/status */
  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const payload = await request.validateUsing(updateStaffPositionStatusValidator)

    try {
      const item = await StaffPositionService.updateStatus(id, payload.status)
      return response.ok({
        success: true,
        message: 'Staff position status updated successfully',
        data: this.serialize(item),
      })
    } catch (err) {
      if ((err as Error).message === 'STAFF_POSITION_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy chức vụ.' })
      }
      throw err
    }
  }
}
