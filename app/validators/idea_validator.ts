import vine from '@vinejs/vine'
import Idea from '#models/idea'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const

export const createIdeaValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500),
    summary: vine.string().trim().minLength(1),
    field: vine.string().trim().minLength(1).maxLength(100),
    suitableLevels: vine.array(vine.enum(Idea.suitableLevelsList)).optional(),
  })
)

export const updateIdeaValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    summary: vine.string().trim().minLength(1).optional(),
    field: vine.string().trim().minLength(1).maxLength(100).optional(),
    suitableLevels: vine.array(vine.enum(Idea.suitableLevelsList)).optional(),
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
