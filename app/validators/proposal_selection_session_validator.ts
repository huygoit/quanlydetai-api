import vine from '@vinejs/vine'

/** Chỉ 2 kết quả: Đồng ý / Không đồng ý (góp ý HĐ lưu ở adjustmentNote, không bắt buộc) */
const COUNCIL_RESULTS = ['DONG_Y', 'KHONG_DONG_Y'] as const

export const upsertSessionResultsValidator = vine.compile(
  vine.object({
    expectedVersion: vine.number().optional(),
    items: vine.array(
      vine.object({
        projectProposalId: vine.number().positive(),
        councilOpinion: vine.string().trim().minLength(1).maxLength(8000),
        councilResult: vine.enum(COUNCIL_RESULTS),
        adjustmentNote: vine.string().trim().maxLength(8000).optional().nullable(),
      })
    ),
  })
)

export const updateSessionMetaValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(500).optional(),
    councilMembers: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(1).maxLength(255),
          role: vine.string().trim().maxLength(255).optional(),
        })
      )
      .optional(),
  })
)

export const bghRejectSessionValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(4000),
  })
)

export const adminUnlockEditValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(4000),
    items: vine.array(
      vine.object({
        projectProposalId: vine.number().positive(),
        councilOpinion: vine.string().trim().minLength(1).maxLength(8000),
        councilResult: vine.enum(COUNCIL_RESULTS),
        adjustmentNote: vine.string().trim().maxLength(8000).optional().nullable(),
      })
    ),
  })
)
