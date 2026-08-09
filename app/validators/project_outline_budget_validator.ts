import vine from '@vinejs/vine'

export const pkhProposeBudgetValidator = vine.compile(
  vine.object({
    proposedBudget: vine.number().min(0),
    note: vine.string().trim().maxLength(5000).optional().nullable(),
    sendToTc: vine.boolean().optional(),
    largeBudgetCouncilDone: vine.boolean().optional(),
    largeBudgetCouncilNote: vine.string().trim().maxLength(5000).optional().nullable(),
    largeBudgetMinutesUrl: vine.string().trim().maxLength(500).optional().nullable(),
    expectedVersion: vine.number().optional().nullable(),
  })
)

export const tcBudgetActionValidator = vine.compile(
  vine.object({
    action: vine.enum(['CONFIRM', 'RETURN']),
    confirmedBudget: vine.number().min(0).optional().nullable(),
    note: vine.string().trim().maxLength(5000).optional().nullable(),
    returnReason: vine.string().trim().maxLength(5000).optional().nullable(),
    expectedVersion: vine.number().optional().nullable(),
  })
)

export const ldBudgetDecisionValidator = vine.compile(
  vine.object({
    decision: vine.enum(['APPROVE', 'REJECT', 'RETURN']),
    note: vine.string().trim().maxLength(5000).optional().nullable(),
    rejectReason: vine.string().trim().maxLength(5000).optional().nullable(),
    returnTarget: vine.enum(['PKH', 'TC']).optional(),
    expectedVersion: vine.number().optional().nullable(),
  })
)
