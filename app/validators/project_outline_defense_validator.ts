import vine from '@vinejs/vine'

const memberSchema = vine.object({
  userId: vine.number().optional().nullable(),
  scientificProfileId: vine.number().optional().nullable(),
  memberName: vine.string().trim().minLength(2).maxLength(255),
  memberEmail: vine.string().email().optional().nullable(),
  roleInCouncil: vine.enum(['CHU_TICH', 'THU_KY', 'UY_VIEN']),
  isExternal: vine.boolean().optional(),
  unit: vine.string().trim().maxLength(255).optional().nullable(),
  proposedSourceNote: vine.string().trim().maxLength(500).optional().nullable(),
})

export const createDefenseSessionValidator = vine.compile(
  vine.object({
    projectOutlineId: vine.number(),
    meetingMode: vine.enum(['IN_PERSON', 'ONLINE', 'HYBRID']),
    meetingAt: vine.string().trim(),
    location: vine.string().trim().maxLength(500).optional().nullable(),
    meetingUrl: vine.string().trim().maxLength(1000).optional().nullable(),
    shortNoticeOverride: vine.boolean().optional(),
    shortNoticeReason: vine.string().trim().minLength(5).maxLength(2000).optional().nullable(),
    confirm: vine.boolean().optional(),
    members: vine.array(memberSchema).minLength(1),
  })
)

export const updateDefenseSessionValidator = vine.compile(
  vine.object({
    meetingMode: vine.enum(['IN_PERSON', 'ONLINE', 'HYBRID']).optional(),
    meetingAt: vine.string().trim().optional(),
    location: vine.string().trim().maxLength(500).optional().nullable(),
    meetingUrl: vine.string().trim().maxLength(1000).optional().nullable(),
    shortNoticeOverride: vine.boolean().optional(),
    shortNoticeReason: vine.string().trim().minLength(5).maxLength(2000).optional().nullable(),
    members: vine.array(memberSchema).optional(),
  })
)

export const cancelDefenseSessionValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(5).maxLength(2000),
  })
)

export const saveDefenseMinutesValidator = vine.compile(
  vine.object({
    discussionNotes: vine.string().trim().minLength(10).maxLength(20000),
    finalScore: vine.number().min(0).max(100).optional().nullable(),
    conclusion: vine.enum(['THONG_QUA', 'THONG_QUA_DIEU_CHINH', 'KHONG_THONG_QUA']).optional().nullable(),
    adjustmentRequirements: vine.string().trim().maxLength(10000).optional().nullable(),
    adjustmentDeadline: vine.string().trim().optional().nullable(),
    attendances: vine
      .array(
        vine.object({
          memberId: vine.number(),
          attendance: vine.enum(['PENDING', 'PRESENT', 'ABSENT']),
        })
      )
      .optional(),
  })
)

export const finalizeDefenseValidator = vine.compile(
  vine.object({
    discussionNotes: vine.string().trim().minLength(10).maxLength(20000),
    finalScore: vine.number().min(0).max(100).optional().nullable(),
    conclusion: vine.enum(['THONG_QUA', 'THONG_QUA_DIEU_CHINH', 'KHONG_THONG_QUA']),
    adjustmentRequirements: vine.string().trim().maxLength(10000).optional().nullable(),
    adjustmentDeadline: vine.string().trim().optional().nullable(),
    attendances: vine
      .array(
        vine.object({
          memberId: vine.number(),
          attendance: vine.enum(['PRESENT', 'ABSENT']),
        })
      )
      .minLength(1),
  })
)

export const confirmDefenseValidator = vine.compile(
  vine.object({
    shortNoticeOverride: vine.boolean().optional(),
    shortNoticeReason: vine.string().trim().minLength(5).maxLength(2000).optional().nullable(),
  })
)
