import vine from '@vinejs/vine'

const scoreLineSchema = vine.object({
  criterionCode: vine.string().trim().minLength(1).maxLength(60),
  score: vine.number().min(0).optional().nullable(),
  comment: vine.string().trim().optional().nullable(),
})

/** Kết luận BM-02.09 (+ giữ DAT/KHONG_DAT cho phiếu cũ) */
const CONCLUSIONS = ['DE_XUAT', 'HOAN_THIEN', 'KHONG_DE_XUAT', 'DAT', 'KHONG_DAT'] as const

export const saveReviewScoreDraftValidator = vine.compile(
  vine.object({
    generalComment: vine.string().trim().optional().nullable(),
    conclusion: vine.enum(CONCLUSIONS).optional().nullable(),
    precheckEligible: vine.boolean().optional().nullable(),
    precheckConflictCleared: vine.boolean().optional().nullable(),
    precheckEthicsOk: vine.boolean().optional().nullable(),
    lines: vine.array(scoreLineSchema).optional(),
  })
)

export const submitReviewScoreValidator = vine.compile(
  vine.object({
    generalComment: vine.string().trim().optional().nullable(),
    conclusion: vine.enum(CONCLUSIONS).optional().nullable(),
    precheckEligible: vine.boolean().optional().nullable(),
    precheckConflictCleared: vine.boolean().optional().nullable(),
    precheckEthicsOk: vine.boolean().optional().nullable(),
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
