import type { HttpContext } from '@adonisjs/core/http'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'
import ResearchOutputTypeService from '#services/research_output_type_service'
import { validateByKind } from '#services/research_output_rule_validator_service'
import { upsertResearchOutputTypeRuleValidator } from '#validators/research_output_type_validator'

/**
 * Admin: xem / tạo-sửa rule quy đổi cho leaf type.
 */
export default class AdminResearchOutputRulesController {
  /** GET /api/admin/research-output-types/:id/rule */
  async show({ params, response }: HttpContext) {
    const typeId = Number(params.id)
    if (!Number.isFinite(typeId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }
    const rule = await ResearchOutputRule.query().where('type_id', typeId).first()
    if (!rule) {
      return response.notFound({ success: false, message: 'Loại này chưa có rule.' })
    }
    return response.ok({
      success: true,
      data: {
        id: rule.id,
        typeId: rule.typeId,
        ruleKind: rule.ruleKind,
        pointsValue: rule.pointsValue,
        hoursValue: rule.hoursValue,
        hoursMultiplierVar: rule.hoursMultiplierVar,
        hoursBonus: rule.hoursBonus,
        meta: rule.meta,
        evidenceRequirements: rule.evidenceRequirements,
      },
    })
  }

  /** PUT /api/admin/research-output-types/:id/rule */
  async upsert({ params, request, response }: HttpContext) {
    const typeId = Number(params.id)
    if (!Number.isFinite(typeId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }
    const type = await ResearchOutputType.find(typeId)
    if (!type) return response.notFound({ success: false, message: 'Không tìm thấy loại.' })
    const isLeaf = await ResearchOutputTypeService.isLeaf(typeId)
    if (!isLeaf) {
      return response.badRequest({
        success: false,
        message: 'Chỉ node lá (không có con) mới được gắn rule.',
      })
    }
    const payload = await request.validateUsing(upsertResearchOutputTypeRuleValidator)
    validateByKind({
      ruleKind: payload.ruleKind,
      pointsValue: payload.pointsValue,
      hoursValue: payload.hoursValue,
      hoursMultiplierVar: payload.hoursMultiplierVar,
      hoursBonus: payload.hoursBonus,
      meta: (payload.meta as Record<string, unknown>) ?? {},
      evidenceRequirements: payload.evidenceRequirements,
    })
    const meta = (payload.meta as Record<string, unknown>) ?? {}
    const existing = await ResearchOutputRule.query().where('type_id', typeId).first()
    if (existing) {
      existing.ruleKind = payload.ruleKind
      existing.pointsValue = payload.pointsValue ?? null
      existing.hoursValue = payload.hoursValue ?? null
      existing.hoursMultiplierVar = payload.hoursMultiplierVar ?? null
      existing.hoursBonus = payload.hoursBonus ?? null
      existing.meta = meta
      existing.evidenceRequirements = payload.evidenceRequirements ?? null
      await existing.save()
      return response.ok({ success: true, data: existing })
    }
    const rule = await ResearchOutputRule.create({
      typeId,
      ruleKind: payload.ruleKind,
      pointsValue: payload.pointsValue ?? null,
      hoursValue: payload.hoursValue ?? null,
      hoursMultiplierVar: payload.hoursMultiplierVar ?? null,
      hoursBonus: payload.hoursBonus ?? null,
      meta,
      evidenceRequirements: payload.evidenceRequirements ?? null,
    })
    return response.ok({ success: true, data: rule })
  }
}
