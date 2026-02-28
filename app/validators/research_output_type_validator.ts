import vine from '@vinejs/vine'

const RULE_KINDS = ['FIXED', 'MULTIPLY_A', 'HDGSNN_POINTS_TO_HOURS', 'MULTIPLY_C', 'RANGE_REVENUE', 'BONUS_ADD'] as const

/** Tạo node mới (level 1: parent_id null; 2–3: parent_id bắt buộc). */
export const createResearchOutputTypeValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(50),
    name: vine.string().trim().minLength(1).maxLength(255),
    level: vine.number().min(1).max(3),
    parentId: vine.number().optional(),
    sortOrder: vine.number().optional(),
    isActive: vine.boolean().optional(),
    note: vine.string().trim().maxLength(2000).optional(),
  })
)

/** Cập nhật node. */
export const updateResearchOutputTypeValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(50).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    level: vine.number().min(1).max(3).optional(),
    parentId: vine.number().optional(),
    sortOrder: vine.number().optional(),
    isActive: vine.boolean().optional(),
    note: vine.string().trim().maxLength(2000).optional(),
  })
)

/** Di chuyển node: đổi parent và/hoặc thứ tự. */
export const moveResearchOutputTypeValidator = vine.compile(
  vine.object({
    newParentId: vine.number().optional(),
    newSortOrder: vine.number().optional(),
  })
)

/** Upsert rule cho leaf (validate schema; rule_kind logic gọi ResearchOutputRuleValidator). */
export const upsertResearchOutputTypeRuleValidator = vine.compile(
  vine.object({
    ruleKind: vine.enum(RULE_KINDS),
    pointsValue: vine.number().optional(),
    hoursValue: vine.number().optional(),
    hoursMultiplierVar: vine.string().trim().maxLength(10).optional(),
    hoursBonus: vine.number().optional(),
    meta: vine.object({}).allowUnknownProperties().optional(),
    evidenceRequirements: vine.string().trim().maxLength(2000).optional(),
  })
)
