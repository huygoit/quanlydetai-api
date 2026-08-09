import vine from '@vinejs/vine'

const scoreLineSchema = vine.object({
  criterionCode: vine.string().trim().minLength(1).maxLength(60),
  score: vine.number().min(0).optional().nullable(),
  comment: vine.string().trim().optional().nullable(),
})

export const saveReviewScoreDraftValidator = vine.compile(
  vine.object({
    generalComment: vine.string().trim().optional().nullable(),
    conclusion: vine.enum(['DAT', 'KHONG_DAT']).optional().nullable(),
    lines: vine.array(scoreLineSchema).optional(),
  })
)

export const submitReviewScoreValidator = vine.compile(
  vine.object({
    generalComment: vine.string().trim().optional().nullable(),
    conclusion: vine.enum(['DAT', 'KHONG_DAT']).optional().nullable(),
    lines: vine.array(scoreLineSchema).minLength(1),
  })
)

export const reopenReviewScoreValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(5).maxLength(2000),
  })
)

export const extendReviewDeadlineValidator = vine.compile(
  vine.object({
    deadlineAt: vine.string().trim(),
    reason: vine.string().trim().minLength(3).maxLength(2000).optional().nullable(),
  })
)
