import vine from '@vinejs/vine'

const COUNCIL_ROLES = ['CHU_TICH', 'THU_KY', 'PHAN_BIEN_1', 'PHAN_BIEN_2', 'UY_VIEN'] as const

const memberSchema = vine.object({
  userId: vine.number().optional().nullable(),
  scientificProfileId: vine.number().optional().nullable(),
  memberName: vine.string().trim().minLength(2).maxLength(255),
  memberEmail: vine.string().email().optional().nullable(),
  roleInCouncil: vine.enum(COUNCIL_ROLES),
  isExternal: vine.boolean().optional(),
  unit: vine.string().trim().maxLength(255).optional().nullable(),
  proposedSourceNote: vine.string().trim().maxLength(500).optional().nullable(),
})

export const createDefenseSessionValidator = vine.compile(
  vine.object({
    /** Flow mới: nhóm nhiều TM */
    projectOutlineIds: vine.array(vine.number()).minLength(1),
    title: vine.string().trim().maxLength(500).optional().nullable(),
    meetingMode: vine.enum(['IN_PERSON', 'ONLINE', 'HYBRID']),
    meetingAt: vine.string().trim(),
    location: vine.string().trim().maxLength(500).optional().nullable(),
    meetingUrl: vine.string().trim().maxLength(1000).optional().nullable(),
    shortNoticeOverride: vine.boolean().optional(),
    shortNoticeReason: vine.string().trim().minLength(5).maxLength(2000).optional().nullable(),
    members: vine.array(memberSchema).minLength(5),
  })
)

export const updateDefenseSessionValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(500).optional().nullable(),
    meetingMode: vine.enum(['IN_PERSON', 'ONLINE', 'HYBRID']).optional(),
    meetingAt: vine.string().trim().optional(),
    location: vine.string().trim().maxLength(500).optional().nullable(),
    meetingUrl: vine.string().trim().maxLength(1000).optional().nullable(),
    shortNoticeOverride: vine.boolean().optional(),
    shortNoticeReason: vine.string().trim().minLength(5).maxLength(2000).optional().nullable(),
    projectOutlineIds: vine.array(vine.number()).minLength(1).optional(),
    members: vine.array(memberSchema).optional(),
  })
)

export const cancelDefenseSessionValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(5).maxLength(2000),
  })
)

const minutesItemSchema = vine.object({
  projectOutlineId: vine.number(),
  councilConclusion: vine.enum([
    'DE_XUAT_XET',
    'GIAO_TRUC_TIEP',
    'HOAN_THIEN',
    'KHONG_DE_XUAT',
  ]),
  executionContent: vine.string().trim().maxLength(10000).optional().nullable(),
  adjustmentRequirements: vine.string().trim().maxLength(10000).optional().nullable(),
  adjustmentDeadline: vine.string().trim().optional().nullable(),
  note: vine.string().trim().maxLength(4000).optional().nullable(),
})

const attendanceSchema = vine.object({
  memberId: vine.number(),
  attendance: vine.enum(['PENDING', 'PRESENT', 'ABSENT']),
})

/** Lưu nháp / chốt biên bản BM-02.10 (theo từng TM) */
export const saveDefenseMinutesValidator = vine.compile(
  vine.object({
    recommendations: vine.string().trim().maxLength(8000).optional().nullable(),
    attendances: vine.array(attendanceSchema).optional(),
    items: vine.array(minutesItemSchema).minLength(1),
  })
)

export const finalizeDefenseValidator = vine.compile(
  vine.object({
    recommendations: vine.string().trim().maxLength(8000).optional().nullable(),
    attendances: vine.array(attendanceSchema).minLength(1),
    items: vine.array(minutesItemSchema).minLength(1),
  })
)

export const confirmDefenseValidator = vine.compile(
  vine.object({
    shortNoticeOverride: vine.boolean().optional(),
    shortNoticeReason: vine.string().trim().minLength(5).maxLength(2000).optional().nullable(),
  })
)

export const bghSignDefenseValidator = vine.compile(
  vine.object({
    note: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)

export const saveBm05aValidator = vine.compile(
  vine.object({
    precheckEligible: vine.boolean().optional().nullable(),
    precheckConflictCleared: vine.boolean().optional().nullable(),
    precheckEthicsOk: vine.boolean().optional().nullable(),
    scores: vine
      .array(
        vine.object({
          code: vine.string().trim().minLength(1).maxLength(60),
          score: vine.number().min(0).optional().nullable(),
        })
      )
      .optional(),
    conclusion: vine
      .enum(['DE_XUAT', 'HOAN_THIEN', 'KHONG_DE_XUAT'])
      .optional()
      .nullable(),
    generalComment: vine.string().trim().optional().nullable(),
    submit: vine.boolean().optional(),
  })
)
