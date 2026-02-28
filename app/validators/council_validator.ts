import vine from '@vinejs/vine'

export const createCouncilSessionValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255),
    year: vine.number(),
    meetingDate: vine.string().trim().optional(),
    location: vine.string().trim().maxLength(255).optional(),
    note: vine.string().trim().optional(),
  })
)

export const updateCouncilSessionValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    year: vine.number().optional(),
    meetingDate: vine.string().trim().optional(),
    location: vine.string().trim().maxLength(255).optional(),
    note: vine.string().trim().optional(),
  })
)

const ROLES = ['CHU_TICH', 'THU_KY', 'UY_VIEN', 'PHAN_BIEN'] as const

export const addSessionMemberValidator = vine.compile(
  vine.object({
    memberId: vine.number(),
    memberName: vine.string().trim().minLength(1).maxLength(255),
    memberEmail: vine.string().trim().email().maxLength(255).optional(),
    roleInCouncil: vine.enum(ROLES),
    unit: vine.string().trim().maxLength(255).optional(),
  })
)

export const addSessionIdeasValidator = vine.compile(
  vine.object({
    ideas: vine.array(vine.object({ ideaId: vine.number() })),
  })
)

export const saveScoreValidator = vine.compile(
  vine.object({
    noveltyScore: vine.number().min(0).max(10),
    noveltyComment: vine.string().trim().optional(),
    feasibilityScore: vine.number().min(0).max(10),
    feasibilityComment: vine.string().trim().optional(),
    alignmentScore: vine.number().min(0).max(10),
    alignmentComment: vine.string().trim().optional(),
    authorCapacityScore: vine.number().min(0).max(10),
    authorCapacityComment: vine.string().trim().optional(),
    generalComment: vine.string().trim().optional(),
  })
)
