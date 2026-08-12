import vine from '@vinejs/vine'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const

export const createIdeaValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500),
    summary: vine.string().trim().minLength(1),
    // Tên lĩnh vực từ danh mục fields — kiểm tra DB ở controller
    field: vine.string().trim().minLength(1).maxLength(255),
    // Mã QT từ danh mục Cấp ý tưởng/đề tài — kiểm tra DB ở controller
    suitableLevels: vine.array(vine.string().trim()).optional(),
  })
)

export const updateIdeaValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    summary: vine.string().trim().minLength(1).optional(),
    field: vine.string().trim().minLength(1).maxLength(255).optional(),
    suitableLevels: vine.array(vine.string().trim()).optional(),
  })
)

export const rejectIdeaValidator = vine.compile(
  vine.object({
    rejectedReason: vine.string().trim().minLength(1),
  })
)

export const approveInternalValidator = vine.compile(
  vine.object({
    priority: vine.enum(PRIORITIES).optional(),
    noteForReview: vine.string().trim().optional(),
  })
)

export const proposeOrderValidator = vine.compile(
  vine.object({
    priority: vine.enum(PRIORITIES).optional(),
    noteForReview: vine.string().trim().optional(),
  })
)

export const approveOrderValidator = vine.compile(
  vine.object({
    noteForReview: vine.string().trim().optional(),
  })
)

export const councilResultValidator = vine.compile(
  vine.object({
    councilSessionId: vine.number(),
    councilAvgWeightedScore: vine.number(),
    councilAvgNoveltyScore: vine.number(),
    councilAvgFeasibilityScore: vine.number(),
    councilAvgAlignmentScore: vine.number(),
    councilAvgAuthorCapacityScore: vine.number(),
    councilSubmittedCount: vine.number(),
    councilMemberCount: vine.number(),
    councilRecommendation: vine.enum(['PROPOSE_ORDER', 'NOT_PROPOSE'] as const),
  })
)
