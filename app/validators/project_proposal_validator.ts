import vine from '@vinejs/vine'

/** Lĩnh vực (theo prompt 07) */
const FIELD_OPTIONS = [
  'Công nghệ thông tin',
  'Kinh tế - Quản lý',
  'Khoa học xã hội',
  'Kỹ thuật - Công nghệ',
  'Y - Dược',
  'Nông nghiệp - Sinh học',
  'Khoa học tự nhiên',
  'Giáo dục',
] as const

/** Cấp đề tài */
const LEVEL_OPTIONS = ['CO_SO', 'TRUONG', 'BO', 'NHA_NUOC'] as const

/** Mức ưu tiên Phòng KH */
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'] as const

export const createProjectProposalValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500),
    field: vine.enum(FIELD_OPTIONS),
    level: vine.enum(LEVEL_OPTIONS),
    year: vine.number().min(2020).max(2030),
    durationMonths: vine.number().min(1).max(60),
    keywords: vine.array(vine.string().trim().maxLength(100)).optional(),
    coAuthors: vine.array(vine.string().trim().maxLength(255)).optional(),
    objectives: vine.string().trim().minLength(1),
    summary: vine.string().trim().minLength(1),
    contentOutline: vine.string().trim().optional(),
    expectedResults: vine.string().trim().optional(),
    applicationPotential: vine.string().trim().optional(),
    requestedBudgetTotal: vine.number().min(0).optional(),
    requestedBudgetDetail: vine.string().trim().optional(),
    /** Lá danh mục loại kết quả NCKH (nullable) */
    researchOutputTypeId: vine.number().positive().optional().nullable(),
  })
)

export const updateProjectProposalValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    field: vine.enum(FIELD_OPTIONS).optional(),
    level: vine.enum(LEVEL_OPTIONS).optional(),
    year: vine.number().min(2020).max(2030).optional(),
    durationMonths: vine.number().min(1).max(60).optional(),
    keywords: vine.array(vine.string().trim().maxLength(100)).optional(),
    coAuthors: vine.array(vine.string().trim().maxLength(255)).optional(),
    objectives: vine.string().trim().minLength(1).optional(),
    summary: vine.string().trim().minLength(1).optional(),
    contentOutline: vine.string().trim().optional(),
    expectedResults: vine.string().trim().optional(),
    applicationPotential: vine.string().trim().optional(),
    requestedBudgetTotal: vine.number().min(0).optional(),
    requestedBudgetDetail: vine.string().trim().optional(),
    researchOutputTypeId: vine.number().positive().optional().nullable(),
  })
)

/** Trưởng đơn vị cho ý kiến */
export const unitReviewProposalValidator = vine.compile(
  vine.object({
    unitApproved: vine.boolean(),
    unitComment: vine.string().trim().minLength(1),
  })
)

/** Phòng KH phê duyệt / từ chối */
export const sciDeptReviewProposalValidator = vine.compile(
  vine.object({
    status: vine.enum(['APPROVED', 'REJECTED'] as const),
    sciDeptPriority: vine.enum(PRIORITY_OPTIONS).optional(),
    sciDeptComment: vine.string().trim().optional(),
  })
)
