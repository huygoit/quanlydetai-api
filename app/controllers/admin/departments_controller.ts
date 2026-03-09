import type { HttpContext } from '@adonisjs/core/http'
import Department from '#models/department'
import DepartmentService from '#services/department_service'
import { createDepartmentValidator } from '#validators/create_department_validator'
import { updateDepartmentValidator } from '#validators/update_department_validator'
import { updateDepartmentStatusValidator } from '#validators/update_department_status_validator'

/**
 * Admin: CRUD quản lý danh mục đơn vị (department).
 */
export default class AdminDepartmentsController {
  /** Chuẩn hóa department cho response */
  private serializeDepartment(d: Department) {
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      shortName: d.shortName ?? null,
      type: d.type,
      displayOrder: d.displayOrder,
      status: d.status,
      note: d.note ?? null,
      createdAt: d.createdAt.toISO(),
      updatedAt: d.updatedAt?.toISO() ?? null,
    }
  }

  /** GET /api/admin/departments */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 10)
    const keyword = request.input('keyword', '')
    const type = request.input('type', '')
    const status = request.input('status', '')
    const sortBy = request.input('sortBy', '')
    const order = request.input('order', 'asc')

    const paginated = await DepartmentService.paginate({
      page,
      perPage,
      keyword: keyword || undefined,
      type: type || undefined,
      status: status || undefined,
      sortBy: sortBy || undefined,
      order: order === 'desc' ? 'desc' : 'asc',
    })

    const data = paginated.all().map((d) => this.serializeDepartment(d))

    return response.ok({
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

  /** GET /api/admin/departments/:id */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const dept = await DepartmentService.findById(id)
      return response.ok({
        message: 'Department fetched successfully',
        data: this.serializeDepartment(dept),
      })
    } catch (err) {
      if ((err as Error).message === 'DEPARTMENT_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy đơn vị.' })
      }
      throw err
    }
  }

  /** POST /api/admin/departments */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createDepartmentValidator)

    try {
      const dept = await DepartmentService.create({
        code: payload.code,
        name: payload.name,
        shortName: payload.shortName ?? null,
        type: payload.type,
        displayOrder: payload.displayOrder ?? 0,
        status: payload.status ?? 'ACTIVE',
        note: payload.note ?? null,
      })
      return response.created({
        message: 'Department created successfully',
        data: this.serializeDepartment(dept),
      })
    } catch (err) {
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã đơn vị đã tồn tại.',
        })
      }
      throw err
    }
  }

  /** PUT /api/admin/departments/:id */
  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const payload = await request.validateUsing(updateDepartmentValidator)

    try {
      const dept = await DepartmentService.update(id, {
        code: payload.code,
        name: payload.name,
        shortName: payload.shortName,
        type: payload.type,
        displayOrder: payload.displayOrder,
        status: payload.status,
        note: payload.note,
      })
      return response.ok({
        message: 'Department updated successfully',
        data: this.serializeDepartment(dept),
      })
    } catch (err) {
      if ((err as Error).message === 'DEPARTMENT_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy đơn vị.' })
      }
      if ((err as Error).message === 'CODE_EXISTS') {
        return response.unprocessableEntity({
          success: false,
          message: 'Mã đơn vị đã tồn tại.',
        })
      }
      throw err
    }
  }

  /** PATCH /api/admin/departments/:id/status */
  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const payload = await request.validateUsing(updateDepartmentStatusValidator)

    try {
      const dept = await DepartmentService.updateStatus(id, payload.status)
      return response.ok({
        message: 'Department status updated successfully',
        data: this.serializeDepartment(dept),
      })
    } catch (err) {
      if ((err as Error).message === 'DEPARTMENT_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy đơn vị.' })
      }
      throw err
    }
  }
}
