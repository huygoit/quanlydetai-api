import vine from '@vinejs/vine'

const ATTACHMENT_TYPES = ['CV_PDF', 'DEGREE', 'CERTIFICATE', 'OTHER'] as const
const PUB_TYPES = ['JOURNAL', 'CONFERENCE', 'BOOK_CHAPTER', 'BOOK'] as const
const RANKS = ['ISI', 'SCOPUS', 'DOMESTIC', 'OTHER'] as const
const QUARTILES = ['Q1', 'Q2', 'Q3', 'Q4', 'NO_Q'] as const
const DOMESTIC_RULE_TYPES = ['HDGSNN_SCORE', 'CONFERENCE_ISBN'] as const
const PUB_STATUSES = ['PUBLISHED', 'ACCEPTED', 'UNDER_REVIEW'] as const
const MY_ROLES = ['CHU_TRI', 'DONG_TAC_GIA'] as const
const SOURCES = ['INTERNAL', 'GOOGLE_SCHOLAR', 'SCV_DHDN', 'OPENALEX'] as const

/** Regex năm học dạng YYYY-YYYY */
const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/

export const createAttachmentValidator = vine.compile(
  vine.object({
    type: vine.enum(ATTACHMENT_TYPES),
    name: vine.string().trim().minLength(1).maxLength(255),
  })
)

/** Tạo công bố: bắt buộc lá danh mục NCKH; năm học chỉ là metadata để lọc/thống kê (không bắt buộc). */
export const createPublicationValidator = vine.compile(
  vine.object({
    researchOutputTypeId: vine.number().withoutDecimals().positive(),
    title: vine.string().trim().minLength(1).maxLength(500),
    authors: vine.string().trim().minLength(1),
    correspondingAuthor: vine.string().trim().maxLength(255).optional(),
    myRole: vine.enum(MY_ROLES).optional(),
    publicationType: vine.enum(PUB_TYPES).optional(),
    journalOrConference: vine.string().trim().minLength(1).maxLength(500),
    year: vine.number().optional(),
    volume: vine.string().trim().maxLength(20).optional(),
    issue: vine.string().trim().maxLength(20).optional(),
    pages: vine.string().trim().maxLength(50).optional(),
    rank: vine.enum(RANKS).optional(),
    quartile: vine.enum(QUARTILES).optional(),
    academicYear: vine.string().trim().regex(ACADEMIC_YEAR_REGEX).optional(),
    domesticRuleType: vine.enum(DOMESTIC_RULE_TYPES).optional(),
    hdgsnnScore: vine.number().optional(),
    doi: vine.string().trim().maxLength(100).optional(),
    issn: vine.string().trim().maxLength(20).optional(),
    isbn: vine.string().trim().maxLength(20).optional(),
    url: vine.string().trim().url().optional(),
    publicationStatus: vine.enum(PUB_STATUSES),
    source: vine.enum(SOURCES).optional(),
    sourceId: vine.string().trim().maxLength(100).optional(),
    needsIndexConfirmation: vine.boolean().optional(),
    indexMappedCode: vine.string().trim().maxLength(50).optional(),
    indexMappingReason: vine.string().trim().optional(),
    attachmentUrl: vine.string().trim().optional(),
  })
)

export const updatePublicationValidator = vine.compile(
  vine.object({
    researchOutputTypeId: vine.number().withoutDecimals().positive().optional(),
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    authors: vine.string().trim().minLength(1).optional(),
    correspondingAuthor: vine.string().trim().maxLength(255).optional(),
    myRole: vine.enum(MY_ROLES).optional(),
    publicationType: vine.enum(PUB_TYPES).optional(),
    journalOrConference: vine.string().trim().maxLength(500).optional(),
    year: vine.number().optional(),
    volume: vine.string().trim().maxLength(20).optional(),
    issue: vine.string().trim().maxLength(20).optional(),
    pages: vine.string().trim().maxLength(50).optional(),
    rank: vine.enum(RANKS).optional(),
    quartile: vine.enum(QUARTILES).optional(),
    academicYear: vine.string().trim().regex(ACADEMIC_YEAR_REGEX).optional(),
    domesticRuleType: vine.enum(DOMESTIC_RULE_TYPES).optional(),
    hdgsnnScore: vine.number().optional(),
    doi: vine.string().trim().maxLength(100).optional(),
    issn: vine.string().trim().maxLength(20).optional(),
    isbn: vine.string().trim().maxLength(20).optional(),
    url: vine.string().trim().url().optional(),
    publicationStatus: vine.enum(PUB_STATUSES).optional(),
    source: vine.enum(SOURCES).optional(),
    sourceId: vine.string().trim().maxLength(100).optional(),
    needsIndexConfirmation: vine.boolean().optional(),
    indexMappedCode: vine.string().trim().maxLength(50).optional(),
    indexMappingReason: vine.string().trim().optional(),
    attachmentUrl: vine.string().trim().optional(),
  })
)
