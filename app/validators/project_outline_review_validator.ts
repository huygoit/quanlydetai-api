import vine from '@vinejs/vine'

const reviewerRow = vine.object({
  reviewerUserId: vine.number().positive().optional().nullable(),
  scientificProfileId: vine.number().positive().optional().nullable(),
  reviewerName: vine.string().trim().minLength(1).maxLength(255),
  reviewerEmail: vine.string().email().optional().nullable(),
  isExternal: vine.boolean().optional(),
  expertiseExceptionReason: vine.string().trim().maxLength(2000).optional().nullable(),
  workloadOverrideReason: vine.string().trim().maxLength(2000).optional().nullable(),
})

/** POST phân công phản biện kín */
export const assignOutlineReviewersValidator = vine.compile(
  vine.object({
    reviewers: vine.array(reviewerRow).minLength(1).maxLength(10),
    /** ISO datetime deadline — ưu tiên hơn businessDays */
    deadlineAt: vine.string().trim().optional().nullable(),
    /** Số ngày hoàn thành kể từ lúc phân công */
    businessDays: vine.number().min(1).max(90).optional().nullable(),
    reviewerCountTarget: vine.number().min(1).max(10).optional(),
  })
)

/** POST thay phản biện */
export const replaceOutlineReviewerValidator = vine.compile(
  vine.object({
    assignmentId: vine.number().positive(),
    reason: vine.string().trim().minLength(5).maxLength(2000),
    reviewer: reviewerRow,
    deadlineAt: vine.string().trim().optional().nullable(),
    businessDays: vine.number().min(1).max(90).optional().nullable(),
    workloadOverrideReason: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)
