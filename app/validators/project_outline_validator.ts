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
  orgCode: vine.string().trim().maxLength(100).optional().nullable(),
  phone: vine.string().trim().maxLength(50).optional().nullable(),
  address: vine.string().trim().maxLength(500).optional().nullable(),
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
    fundingBreakdown: vine
      .object({
        schoolFund: vine.number().min(0).optional(),
        externalFund: vine.number().min(0).optional(),
        stateBudget: vine.number().min(0).optional(),
        nonStateBudget: vine.number().min(0).optional(),
        lumpSumMode: vine.enum(['FULL', 'PARTIAL'] as const).optional().nullable(),
        lumpSumAmount: vine.number().min(0).optional(),
        nonLumpSumAmount: vine.number().min(0).optional(),
        // Tương thích payload cũ
        externalStateLocal: vine.number().min(0).optional(),
        externalEnterprise: vine.number().min(0).optional(),
        externalSponsor: vine.number().min(0).optional(),
        externalOther: vine.number().min(0).optional(),
      })
      .optional()
      .nullable(),
    principalInfo: vine
      .object({
        profileId: vine.number().positive().optional().nullable(),
        fullName: vine.string().trim().maxLength(255).optional().nullable(),
        identityNumber: vine.string().trim().maxLength(50).optional().nullable(),
        dateOfBirth: vine.string().trim().maxLength(30).optional().nullable(),
        gender: vine.string().trim().maxLength(20).optional().nullable(),
        academicTitleDegree: vine.string().trim().maxLength(255).optional().nullable(),
        professionalTitle: vine.string().trim().maxLength(255).optional().nullable(),
        position: vine.string().trim().maxLength(255).optional().nullable(),
        phone: vine.string().trim().maxLength(50).optional().nullable(),
        email: vine.string().trim().maxLength(255).optional().nullable(),
        organization: vine.string().trim().maxLength(500).optional().nullable(),
        workAddress: vine.string().trim().maxLength(500).optional().nullable(),
      })
      .optional()
      .nullable(),
    hostUnit: vine.string().trim().maxLength(255).optional().nullable(),
    hostOrganization: vine
      .object({
        name: vine.string().trim().maxLength(255).optional().nullable(),
        orgCode: vine.string().trim().maxLength(100).optional().nullable(),
        phone: vine.string().trim().maxLength(50).optional().nullable(),
        address: vine.string().trim().maxLength(500).optional().nullable(),
        leaderName: vine.string().trim().maxLength(255).optional().nullable(),
        experienceHtml: vine.string().trim().optional().nullable(),
        teamCapacityHtml: vine.string().trim().optional().nullable(),
      })
      .optional()
      .nullable(),
    partnerUnits: vine.array(partnerSchema).optional(),
    urgency: vine.string().trim().optional().nullable(),
    detailedObjectives: vine.string().trim().optional().nullable(),
    researchContent: vine.string().trim().optional().nullable(),
    methodology: vine.string().trim().optional().nullable(),
    milestones: vine.array(milestoneSchema).optional(),
    expectedProducts: vine.array(productSchema).optional(),
    expectedResults: vine
      .object({
        publications: vine
          .array(
            vine.object({
              id: vine.string().trim().optional(),
              category: vine.string().trim().optional(),
              content: vine.string().trim().optional(),
              quantity: vine.string().trim().optional().nullable(),
              scienceRequirement: vine.string().trim().optional().nullable(),
              note: vine.string().trim().optional().nullable(),
            })
          )
          .optional(),
        appliedProducts: vine
          .array(
            vine.object({
              id: vine.string().trim().optional(),
              name: vine.string().trim().optional(),
              scienceRequirement: vine.string().trim().optional().nullable(),
              note: vine.string().trim().optional().nullable(),
            })
          )
          .optional(),
        tangibleProducts: vine
          .array(
            vine.object({
              id: vine.string().trim().optional(),
              name: vine.string().trim().optional(),
              unit: vine.string().trim().optional().nullable(),
              qualityRequired: vine.string().trim().optional().nullable(),
              qualitySampleDomestic: vine.string().trim().optional().nullable(),
              qualitySampleWorld: vine.string().trim().optional().nullable(),
              quantityScale: vine.string().trim().optional().nullable(),
            })
          )
          .optional(),
        ipProducts: vine
          .array(
            vine.object({
              id: vine.string().trim().optional(),
              name: vine.string().trim().optional(),
              scienceRequirement: vine.string().trim().optional().nullable(),
              note: vine.string().trim().optional().nullable(),
            })
          )
          .optional(),
        postgraduateTraining: vine
          .array(
            vine.object({
              id: vine.string().trim().optional(),
              level: vine.string().trim().optional(),
              quantity: vine.string().trim().optional().nullable(),
              major: vine.string().trim().optional().nullable(),
              note: vine.string().trim().optional().nullable(),
            })
          )
          .optional(),
      })
      .optional()
      .nullable(),
    summary: vine.string().trim().optional().nullable(),
    outlineFileUrl: vine.string().trim().maxLength(500).optional().nullable(),
    appendixFileUrl: vine.string().trim().maxLength(500).optional().nullable(),
    revisionExplanation: vine.string().trim().optional().nullable(),
    members: vine.array(memberSchema).optional(),
    budgetLines: vine.array(budgetLineSchema).optional(),
    budgetMatrix: vine.any().optional().nullable(),
    otherContents: vine
      .object({
        applicationTransferHtml: vine.string().trim().optional().nullable(),
        outputEffectivenessHtml: vine.string().trim().optional().nullable(),
        impactAssessmentHtml: vine.string().trim().optional().nullable(),
        riskManagementHtml: vine.string().trim().optional().nullable(),
        ethicsDataApprovalHtml: vine.string().trim().optional().nullable(),
        dataManagementPlanHtml: vine.string().trim().optional().nullable(),
        ipProtectionHtml: vine.string().trim().optional().nullable(),
        aiUsageHtml: vine.string().trim().optional().nullable(),
      })
      .optional()
      .nullable(),
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
