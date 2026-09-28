import type { HttpContext } from '@adonisjs/core/http'
import ProjectOutline from '#models/project_outline'
import PermissionService from '#services/permission_service'
import ProjectContractService from '#services/project_contract_service'

/**
 * US-05-01 bước 1 — dự thảo hợp đồng BM.06.
 */
export default class ProjectContractsController {
  private async canManage(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.contract_manage')) ||
      (await PermissionService.userHasPermission(userId, 'project.budget_propose')) ||
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  private async canView(userId: number) {
    return (
      (await this.canManage(userId)) ||
      (await PermissionService.userHasPermission(userId, 'project.outline_approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.view'))
    )
  }

  async index({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const paginated = await ProjectContractService.list({
      page: Number(request.input('page', 1)),
      perPage: Number(request.input('perPage', 20)),
      status: request.input('status', '') || undefined,
      keyword: request.input('keyword', '') || undefined,
    })
    return response.ok({
      success: true,
      data: paginated.all().map((r) => ProjectContractService.serialize(r, r.outline)),
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const row = await ProjectContractService.findById(id)
      return response.ok({
        success: true,
        data: {
          ...ProjectContractService.serialize(row, row.outline),
          roles: {
            canManage: await this.canManage(user.id),
          },
        },
      })
    } catch (err) {
      return this.mapError(response, err)
    }
  }

  /** GET theo thuyết minh */
  async showByOutline({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const outlineId = Number(params.outlineId)
    const row = await ProjectContractService.findByOutlineId(outlineId)
    if (!row) {
      return response.notFound({ success: false, message: 'Chưa có dự thảo hợp đồng.' })
    }
    return response.ok({
      success: true,
      data: ProjectContractService.serialize(row, row.outline),
    })
  }

  /** POST sinh / lấy dự thảo theo outline (manual hoặc bù nếu auto lỗi) */
  async generate({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canManage(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH sinh dự thảo hợp đồng.' })
    }
    const outlineId = Number(params.outlineId)
    const outline = await ProjectOutline.find(outlineId)
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const forceRegen =
      request.input('forceRegen') === true ||
      request.input('forceRegen') === 'true' ||
      request.input('force_regen') === 'true'
    try {
      const result = await ProjectContractService.generateDraft(outline, user.id, {
        forceRegen,
      })
      return response.ok({
        success: true,
        message: result.regenerated
          ? 'Đã tạo lại dự thảo hợp đồng.'
          : result.created
            ? 'Đã sinh dự thảo hợp đồng BM.06.'
            : 'Dự thảo đã tồn tại.',
        data: ProjectContractService.serialize(result.row, outline),
      })
    } catch (err) {
      return this.mapError(response, err)
    }
  }

  async download({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const id = Number(params.id)
    try {
      const { row, filePath } = await ProjectContractService.resolveDownloadPath(id)
      response.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(row.fileName)}"`
      )
      response.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      return response.download(filePath)
    } catch (err) {
      return this.mapError(response, err)
    }
  }

  private mapError(response: HttpContext['response'], err: unknown) {
    const msg = (err as Error)?.message || ''
    const map: Record<string, [number, string]> = {
      CONTRACT_NOT_FOUND: [404, 'Không tìm thấy hợp đồng.'],
      OUTLINE_NOT_READY: [
        422,
        'Thuyết minh chưa được phê duyệt / mở Module 5 — chưa thể sinh hợp đồng.',
      ],
      NO_DEFAULT_TEMPLATE: [
        422,
        'Chưa có mẫu hợp đồng mặc định (loại Hợp đồng). Vào Admin → Mẫu biểu mẫu DOCX.',
      ],
      TEMPLATE_FILE_MISSING: [422, 'File mẫu DOCX không còn trên ổ đĩa.'],
      CANNOT_REGEN: [422, 'Chỉ tạo lại khi hợp đồng còn ở trạng thái dự thảo.'],
      FILE_NOT_FOUND: [404, 'Không tìm thấy file dự thảo trên ổ đĩa.'],
    }
    const hit = map[msg]
    if (hit) {
      const [status, message] = hit
      if (status === 404) return response.notFound({ success: false, message })
      return response.unprocessableEntity({ success: false, message })
    }
    // Docxtemplater lỗi thường có properties
    const dt = err as { properties?: { errors?: Array<{ message?: string }> } }
    if (dt?.properties?.errors?.length) {
      return response.unprocessableEntity({
        success: false,
        message: `Lỗi merge DOCX: ${dt.properties.errors.map((e) => e.message).join('; ')}`,
      })
    }
    throw err
  }
}
