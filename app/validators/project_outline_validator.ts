import vine from '@vinejs/vine'

const milestoneSchema = vine.object({
  content: vine.string().trim().maxLength(2000),
  startDate: vine.string().trim().optional().nullable(),
  endDate: vine.string().trim().optional().nullable(),
  expectedResult: vine.string().trim().maxLength(2000).optional().nullable(),
})

const productSchema = vine.object({
  name: vine.string().trim().maxLength(500),
  quantity: vine.string().trim().maxLength(100).optional().nullable(),
  quality: vine.string().trim().maxLength(500).optional().nullable(),
})

const partnerSchema = vine.object({
  name: vine.string().trim().maxLength(255),
  role: vine.string().trim().maxLength(255).optional().nullable(),
})

const memberSchema = vine.object({
  id: vine.number().positive().optional(),
  profileId: vine.number().positive().optional().nullable(),
  studentId: vine.number().positive().optional().nullable(),
  departmentId: vine.number().positive().optional().nullable(),
  profile_id: vine.number().positive().optional().nullable(),
  student_id: vine.number().positive().optional().nullable(),
  fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
  full_name: vine.string().trim().minLength(1).maxLength(255).optional(),
  memberOrder: vine.number().min(1).optional(),
  authorOrder: vine.number().min(1).optional(),
  member_order: vine.number().min(1).optional(),
  author_order: vine.number().min(1).optional(),
  role: vine.enum(['PRINCIPAL', 'SECRETARY', 'MEMBER']).optional(),
  proposalMemberRole: vine.enum(['PRINCIPAL', 'SECRETARY', 'MEMBER']).optional(),
  affiliationType: vine.string().trim().maxLength(40).optional().nullable(),
  affiliation_type: vine.string().trim().maxLength(40).optional().nullable(),
  affiliationUnits: vine.array(vine.string().trim().maxLength(255)).optional(),
  affiliation_units: vine.array(vine.string().trim().maxLength(255)).optional(),
  contributionPercent: vine.number().min(0).max(100).optional().nullable(),
  contribution_percent: vine.number().min(0).max(100).optional().nullable(),
  participationHours: vine.number().min(0).optional().nullable(),
  gender: vine.string().trim().maxLength(20).optional().nullable(),
  isMultiAffiliationOutsideUdn: vine.boolean().optional(),
  is_multi_affiliation_outside_udn: vine.boolean().optional(),
  isTopAuthor: vine.boolean().optional(),
  isCorresponding: vine.boolean().optional(),
})

const budgetLineSchema = vine.object({
  groupCode: vine.enum(['NHAN_CONG', 'VAT_TU', 'HOI_THAO', 'KHAC']),
  content: vine.string().trim().minLength(1).maxLength(500),
  amount: vine.number().min(0),
  note: vine.string().trim().maxLength(1000).optional().nullable(),
  lineOrder: vine.number().min(1).optional(),
})

/** Lưu nháp — lỏng */
export const updateOutlineDraftValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    projectProcessTypeId: vine.number().positive().optional().nullable(),
    level: vine.string().trim().maxLength(20).optional().nullable(),
    field: vine.string().trim().maxLength(100).optional().nullable(),
    startDate: vine.string().trim().optional().nullable(),
    endDate: vine.string().trim().optional().nullable(),
    requestedBudget: vine.number().min(0).optional(),
    hostUnit: vine.string().trim().maxLength(255).optional().nullable(),
    partnerUnits: vine.array(partnerSchema).optional(),
    applicationScope: vine.string().trim().optional().nullable(),
    urgency: vine.string().trim().optional().nullable(),
    detailedObjectives: vine.string().trim().optional().nullable(),
    researchContent: vine.string().trim().optional().nullable(),
    methodology: vine.string().trim().optional().nullable(),
    milestones: vine.array(milestoneSchema).optional(),
    expectedProducts: vine.array(productSchema).optional(),
    summary: vine.string().trim().optional().nullable(),
    outlineFileUrl: vine.string().trim().maxLength(500).optional().nullable(),
    appendixFileUrl: vine.string().trim().maxLength(500).optional().nullable(),
    revisionExplanation: vine.string().trim().optional().nullable(),
    members: vine.array(memberSchema).optional(),
    budgetLines: vine.array(budgetLineSchema).optional(),
  })
)

export const submitOutlineRevisionValidator = vine.compile(
  vine.object({
    explanation: vine.string().trim().minLength(100).maxLength(20000),
  })
)

export const extendOutlineRevisionValidator = vine.compile(
  vine.object({
    deadlineAt: vine.string().trim(),
    reason: vine.string().trim().minLength(5).maxLength(2000),
  })
)
