import type { HttpContext } from '@adonisjs/core/http'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputTypeService from '#services/research_output_type_service'
import {
  createResearchOutputTypeValidator,
  updateResearchOutputTypeValidator,
  moveResearchOutputTypeValidator,
} from '#validators/research_output_type_validator'

/**
 * Admin: CRUD + tree + move cho loại kết quả NCKH (cây 2–3 cấp).
 */
export default class AdminResearchOutputTypesController {
  /** GET /api/admin/research-output-types/tree */
  async tree({ response }: HttpContext) {
    const data = await ResearchOutputTypeService.getTree()
    return response.ok({ success: true, data })
  }

  /** POST /api/admin/research-output-types */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createResearchOutputTypeValidator)
    if (payload.level === 1 && payload.parentId != null) {
      return response.badRequest({ success: false, message: 'Level 1 phải có parent_id = null.' })
    }
    if (payload.level > 1 && (payload.parentId == null || payload.parentId === undefined)) {
      return response.badRequest({ success: false, message: 'Level 2–3 bắt buộc parent_id.' })
    }
    const level =
      payload.parentId != null
        ? await ResearchOutputTypeService.computeLevel(payload.parentId)
        : 1
    if (payload.level !== level) {
      return response.badRequest({
        success: false,
        message: `Level phải là ${level} khi parent_id = ${payload.parentId ?? 'null'}.`,
      })
    }
    const type = await ResearchOutputType.create({
      code: payload.code,
      name: payload.name,
      level: payload.level,
      parentId: payload.parentId ?? null,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
      note: payload.note ?? null,
    })
    return response.created({ success: true, data: type })
  }

  /** PUT /api/admin/research-output-types/:id */
  async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }
    const type = await ResearchOutputType.find(id)
    if (!type) return response.notFound({ success: false, message: 'Không tìm thấy loại.' })
    const payload = await request.validateUsing(updateResearchOutputTypeValidator)
    if (payload.parentId !== undefined) {
      await ResearchOutputTypeService.assertNoCycle(id, payload.parentId ?? null)
      const newLevel = await ResearchOutputTypeService.computeLevel(payload.parentId ?? null)
      if (payload.level !== undefined && payload.level !== newLevel) {
        return response.badRequest({
          success: false,
          message: `Level phải là ${newLevel} theo parent mới.`,
        })
      }
      type.parentId = payload.parentId ?? null
      type.level = newLevel
    }
    if (payload.code !== undefined) type.code = payload.code
    if (payload.name !== undefined) type.name = payload.name
    if (payload.level !== undefined) type.level = payload.level
    if (payload.sortOrder !== undefined) type.sortOrder = payload.sortOrder
    if (payload.isActive !== undefined) type.isActive = payload.isActive
    if (payload.note !== undefined) type.note = payload.note
    await type.save()
    return response.ok({ success: true, data: type })
  }

  /** DELETE /api/admin/research-output-types/:id */
  async destroy({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }
    const type = await ResearchOutputType.find(id)
    if (!type) return response.notFound({ success: false, message: 'Không tìm thấy loại.' })
    const cascade = request.input('cascade', 0)
    if (cascade === 1 || cascade === '1') {
      await type.delete()
      return response.ok({ success: true, message: 'Đã xoá (cascade).' })
    }
    const isLeaf = await type.isLeaf()
    if (!isLeaf) {
      return response.conflict({
        success: false,
        message: 'Không thể xoá vì còn node con. Dùng ?cascade=1 để xoá cả cây con.',
      })
    }
    await type.delete()
    return response.ok({ success: true, message: 'Đã xoá.' })
  }

  /** PUT /api/admin/research-output-types/:id/move */
  async move({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }
    const type = await ResearchOutputType.find(id)
    if (!type) return response.notFound({ success: false, message: 'Không tìm thấy loại.' })
    const payload = await request.validateUsing(moveResearchOutputTypeValidator)
    const newParentId = payload.newParentId !== undefined ? payload.newParentId ?? null : type.parentId
    await ResearchOutputTypeService.assertNoCycle(id, newParentId)
    const newLevel = await ResearchOutputTypeService.computeLevel(newParentId)
    type.parentId = newParentId
    type.level = newLevel
    if (payload.newSortOrder !== undefined) type.sortOrder = payload.newSortOrder
    await type.save()
    return response.ok({ success: true, data: type })
  }
}
