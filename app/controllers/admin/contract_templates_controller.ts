import type { HttpContext } from '@adonisjs/core/http'
import ContractTemplateService from '#services/contract_template_service'
import {
  createContractTemplateValidator,
  updateContractTemplateValidator,
  updateContractTemplateStatusValidator,
} from '#validators/contract_template_validator'

/**
 * US-05-01 — Admin quản lý mẫu DOCX (hợp đồng, thanh lý, …).
 */
export default class AdminContractTemplatesController {
  async types({ response }: HttpContext) {
    return response.ok({
      success: true,
      data: ContractTemplateService.listTypes(),
    })
  }

  async variableCatalog({ request, response }: HttpContext) {
    const templateType =
      request.input('templateType', '') || request.input('template_type', '') || undefined
    return response.ok({
      success: true,
      data: ContractTemplateService.listVariableCatalog(templateType),
    })
  }

  async index({ request, response }: HttpContext) {
    const paginated = await ContractTemplateService.paginate({
      page: Number(request.input('page', 1)),
      perPage: Number(request.input('perPage', 20)),
      keyword: request.input('keyword', '') || undefined,
      status: request.input('status', '') || undefined,
      templateType:
        request.input('templateType', '') ||
        request.input('template_type', '') ||
        undefined,
      formCode: request.input('formCode', '') || request.input('form_code', '') || undefined,
      sortBy: request.input('sortBy', '') || undefined,
      order: request.input('order', 'desc') === 'asc' ? 'asc' : 'desc',
    })
    return response.ok({
      success: true,
      data: paginated.all().map((r) => ContractTemplateService.serialize(r)),
      meta: {
        total: paginated.total,
        perPage: paginated.perPage,
        currentPage: paginated.currentPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const row = await ContractTemplateService.findById(id)
      return response.ok({
        success: true,
        data: ContractTemplateService.serialize(row),
      })
    } catch (err) {
      if ((err as Error).message === 'CONTRACT_TEMPLATE_NOT_FOUND') {
        return response.notFound({ success: false, message: 'Không tìm thấy mẫu.' })
      }
      throw err
    }
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const file = request.file('file', {
      size: '15mb',
      extnames: ['docx'],
    })
    if (!file) {
      return response.badRequest({
        success: false,
        message: 'Cần upload file DOCX (trường file).',
      })
    }
    if (!file.isValid) {
      return response.badRequest({
        success: false,
        message: file.errors?.[0]?.message || 'File không hợp lệ (chỉ .docx, ≤ 15MB).',
      })
    }

    const payload = await request.validateUsing(createContractTemplateValidator)
    const isDefaultRaw = request.input('isDefault', request.input('is_default'))
    const isDefault =
      isDefaultRaw === undefined || isDefaultRaw === null || isDefaultRaw === ''
        ? true
        : isDefaultRaw === 'true' ||
          isDefaultRaw === true ||
          isDefaultRaw === 1 ||
          isDefaultRaw === '1'
    try {
      const row = await ContractTemplateService.create(
        user.id,
        {
          code: payload.code,
          name: payload.name,
          description: payload.description,
          templateType: payload.templateType,
          formCode: payload.formCode,
          status: payload.status,
          isDefault,
        },
        file
      )
      return response.created({
        success: true,
        message: 'Đã tạo mẫu DOCX.',
        data: ContractTemplateService.serialize(row),
      })
    } catch (err) {
      return this.mapError(response, err)
    }
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }

    const file = request.file('file', {
      size: '15mb',
      extnames: ['docx'],
    })
    if (file && !file.isValid) {
      return response.badRequest({
        success: false,
        message: file.errors?.[0]?.message || 'File không hợp lệ (chỉ .docx, ≤ 15MB).',
      })
    }

    const payload = await request.validateUsing(updateContractTemplateValidator)
    const isDefaultRaw = request.input('isDefault', request.input('is_default'))
    let isDefault: boolean | undefined
    if (
      isDefaultRaw === 'true' ||
      isDefaultRaw === true ||
      isDefaultRaw === 1 ||
      isDefaultRaw === '1'
    ) {
      isDefault = true
    }
    if (
      isDefaultRaw === 'false' ||
      isDefaultRaw === false ||
      isDefaultRaw === 0 ||
      isDefaultRaw === '0'
    ) {
      isDefault = false
    }

    try {
      const row = await ContractTemplateService.update(
        id,
        user.id,
        {
          code: payload.code,
          name: payload.name,
          description: payload.description,
          templateType: payload.templateType,
          formCode: payload.formCode,
          status: payload.status,
          isDefault,
        },
        file || null
      )
      return response.ok({
        success: true,
        message: 'Đã cập nhật mẫu.',
        data: ContractTemplateService.serialize(row),
      })
    } catch (err) {
      return this.mapError(response, err)
    }
  }

  async changeStatus({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    const payload = await request.validateUsing(updateContractTemplateStatusValidator)
    try {
      const row = await ContractTemplateService.updateStatus(id, payload.status)
      return response.ok({
        success: true,
        message: 'Đã cập nhật trạng thái.',
        data: ContractTemplateService.serialize(row),
      })
    } catch (err) {
      return this.mapError(response, err)
    }
  }

  async setDefault({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const row = await ContractTemplateService.setDefault(id)
      return response.ok({
        success: true,
        message: 'Đã đặt làm mẫu mặc định cho loại này.',
        data: ContractTemplateService.serialize(row),
      })
    } catch (err) {
      return this.mapError(response, err)
    }
  }

  async destroy({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      await ContractTemplateService.destroy(id)
      return response.ok({ success: true, message: 'Đã xóa mẫu.' })
    } catch (err) {
      return this.mapError(response, err)
    }
  }

  async download({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'ID không hợp lệ.' })
    }
    try {
      const { row, filePath } = await ContractTemplateService.resolveDownloadPath(id)
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
      CONTRACT_TEMPLATE_NOT_FOUND: [404, 'Không tìm thấy mẫu.'],
      CODE_EXISTS: [422, 'Mã mẫu đã tồn tại.'],
      INVALID_FILE_TYPE: [422, 'Chỉ chấp nhận file .docx.'],
      INVALID_TEMPLATE_TYPE: [422, 'Loại template không hợp lệ.'],
      UPLOAD_FAILED: [422, 'Tải file thất bại.'],
      TEMPLATE_INACTIVE: [422, 'Không thể đặt mẫu đang ngừng hoạt động làm mặc định.'],
      CANNOT_DISABLE_DEFAULT: [
        422,
        'Không thể ngừng mẫu đang là mặc định — hãy chọn mẫu khác cùng loại trước.',
      ],
      CANNOT_DELETE_DEFAULT: [
        422,
        'Không thể xóa mẫu mặc định — hãy chọn mẫu khác cùng loại trước.',
      ],
      FILE_NOT_FOUND: [404, 'Không tìm thấy file trên ổ đĩa.'],
    }
    const hit = map[msg]
    if (hit) {
      const [status, message] = hit
      if (status === 404) return response.notFound({ success: false, message })
      return response.unprocessableEntity({ success: false, message })
    }
    throw err
  }
}
