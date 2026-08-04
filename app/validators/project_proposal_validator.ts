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

/** Cấp đề tài (dùng nội bộ / khớp kỳ CFP) */
const LEVEL_OPTIONS = ['CO_SO', 'TRUONG', 'BO', 'NHA_NUOC'] as const

/** Mức ưu tiên Phòng KH */
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'] as const

/** URL file đính kèm (FE đã kiểm tra PDF/DOCX ≤10MB khi upload) */
const attachmentUrlRule = vine.string().trim().maxLength(500)

export const createProjectProposalValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500),
    field: vine.enum(FIELD_OPTIONS),
    /** Phân cấp = loại quy trình đề tài (QT-I…) */
    projectProcessTypeId: vine.number().positive(),
    /** Giữ optional — BE tự suy từ QT nếu thiếu */
    level: vine.enum(LEVEL_OPTIONS).optional(),
    year: vine.number().min(2020).max(2030),
    durationMonths: vine.number().min(1).max(60),
    keywords: vine.array(vine.string().trim().maxLength(100)).optional(),
    coAuthors: vine.array(vine.string().trim().maxLength(255)).optional(),
    objectives: vine.string().trim().minLength(1),
    summary: vine.string().trim().optional(),
    contentOutline: vine.string().trim().optional(),
    expectedResults: vine.string().trim().optional(),
    applicationPotential: vine.string().trim().optional(),
    requestedBudgetTotal: vine.number().min(0).optional(),
    requestedBudgetDetail: vine.string().trim().optional(),
    researchOutputTypeId: vine.number().positive().optional().nullable(),
    researchDirection: vine.string().trim().maxLength(500).optional().nullable(),
    attachmentUrl: attachmentUrlRule.optional().nullable(),
  })
)

export const updateProjectProposalValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    field: vine.enum(FIELD_OPTIONS).optional(),
    projectProcessTypeId: vine.number().positive().optional(),
    level: vine.enum(LEVEL_OPTIONS).optional(),
    year: vine.number().min(2020).max(2030).optional(),
    durationMonths: vine.number().min(1).max(60).optional(),
    keywords: vine.array(vine.string().trim().maxLength(100)).optional(),
    coAuthors: vine.array(vine.string().trim().maxLength(255)).optional(),
    objectives: vine.string().trim().minLength(1).optional(),
    summary: vine.string().trim().optional(),
    contentOutline: vine.string().trim().optional(),
    expectedResults: vine.string().trim().optional(),
    applicationPotential: vine.string().trim().optional(),
    requestedBudgetTotal: vine.number().min(0).optional(),
    requestedBudgetDetail: vine.string().trim().optional(),
    researchOutputTypeId: vine.number().positive().optional().nullable(),
    researchDirection: vine.string().trim().maxLength(500).optional().nullable(),
    attachmentUrl: attachmentUrlRule.optional().nullable(),
  })
)

/** Trưởng đơn vị xác nhận hồ sơ → CHO_PKH */
export const unitReviewProposalValidator = vine.compile(
  vine.object({
    unitApproved: vine.boolean(),
    unitComment: vine.string().trim().minLength(1),
  })
)

/** Khoa trả lại hồ sơ cho GV */
export const unitReturnProposalValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(2000),
  })
)

/** PKH yêu cầu bổ sung */
export const requestSupplementValidator = vine.compile(
  vine.object({
    note: vine.string().trim().minLength(1).maxLength(4000),
  })
)

/** PKH gia hạn bổ sung */
export const extendSupplementValidator = vine.compile(
  vine.object({
    dueAt: vine.string().trim().minLength(1),
    reason: vine.string().trim().maxLength(2000).optional(),
  })
)

/** PKH loại hồ sơ */
export const rejectByPkhValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(4000),
  })
)

/** Tạo phiên xét chọn */
export const createSelectionSessionValidator = vine.compile(
  vine.object({
    callForProposalId: vine.number().positive(),
    meetingAt: vine.string().trim().minLength(1),
    location: vine.string().trim().minLength(1).maxLength(500),
    /** Bỏ qua cảnh báo < 5 ngày làm việc */
    forceConfirm: vine.boolean().optional(),
  })
)

/** US-03-05 — GV nộp lại điều chỉnh theo yêu cầu HĐ */
export const submitCouncilAdjustmentValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500),
    objectives: vine.string().trim().minLength(1),
    explanation: vine.string().trim().minLength(50).maxLength(4000),
  })
)

/** PKH gia hạn điều chỉnh */
export const extendAdjustmentValidator = vine.compile(
  vine.object({
    dueAt: vine.string().trim().minLength(1).optional(),
    businessDays: vine.number().min(1).max(30).optional(),
    reason: vine.string().trim().maxLength(2000).optional(),
  })
)
