import vine from '@vinejs/vine'
import { createPublicationValidator, updatePublicationValidator } from '#validators/publication_validator'

/** Tạo KQNC từ module quản lý — không bắt buộc profileId (khác luồng chủ kê khai /profile/me) */
export const adminCreatePublicationValidator = vine.compile(
  vine.object({
    profileId: vine.number().withoutDecimals().positive().optional(),
    researchOutputTypeId: vine.number().withoutDecimals().positive(),
    title: vine.string().trim().minLength(1).maxLength(500),
    authors: vine.string().trim().minLength(1),
    correspondingAuthor: vine.string().trim().maxLength(255).optional(),
    myRole: vine.enum(['CHU_TRI', 'DONG_TAC_GIA'] as const).optional(),
    publicationType: vine.enum(['JOURNAL', 'CONFERENCE', 'BOOK_CHAPTER', 'BOOK'] as const).optional(),
    journalOrConference: vine.string().trim().minLength(1).maxLength(500),
    publisher: vine.string().trim().maxLength(500).nullable().optional(),
    publishedAt: vine.string().trim().maxLength(10).nullable().optional(),
    published_at: vine.string().trim().maxLength(10).nullable().optional(),
    year: vine.number().optional(),
    volume: vine.string().trim().maxLength(20).optional(),
    issue: vine.string().trim().maxLength(20).optional(),
    pages: vine.string().trim().maxLength(50).optional(),
    rank: vine.enum(['ISI', 'SCOPUS', 'DOMESTIC', 'OTHER'] as const).optional(),
    quartile: vine.enum(['Q1', 'Q2', 'Q3', 'Q4', 'NO_Q'] as const).optional(),
    academicYear: vine
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/)
      .optional(),
    domesticRuleType: vine.enum(['HDGSNN_SCORE', 'CONFERENCE_ISBN'] as const).optional(),
    hdgsnnScore: vine.number().optional(),
    doi: vine.string().trim().maxLength(100).optional(),
    issn: vine.string().trim().maxLength(20).optional(),
    isbn: vine.string().trim().maxLength(20).optional(),
    url: vine.string().trim().url().optional(),
    qRankUrl: vine.string().trim().maxLength(500).nullable().optional(),
    reputableListUrl: vine.string().trim().maxLength(500).nullable().optional(),
    acceptanceGrade: vine.enum(['EXCELLENT', 'PASS_ON_TIME', 'PASS_LATE'] as const).nullable().optional(),
    publicationStatus: vine.enum(['PUBLISHED', 'ACCEPTED', 'UNDER_REVIEW'] as const),
    source: vine.enum(['INTERNAL', 'GOOGLE_SCHOLAR', 'SCV_DHDN', 'OPENALEX'] as const).optional(),
    sourceId: vine.string().trim().maxLength(100).optional(),
    needsIndexConfirmation: vine.boolean().optional(),
    indexMappedCode: vine.string().trim().maxLength(50).optional(),
    indexMappingReason: vine.string().trim().optional(),
    attachmentUrl: vine.string().trim().optional(),
    verifiedByNcv: vine.boolean().optional(),
  })
)

/** Cập nhật KQNC admin — cho phép đổi profileId (kê khai hộ) */
export const adminUpdatePublicationValidator = vine.compile(
  vine.object({
    profileId: vine.number().withoutDecimals().positive().optional(),
    researchOutputTypeId: vine.number().withoutDecimals().positive().optional(),
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    authors: vine.string().trim().minLength(1).optional(),
    correspondingAuthor: vine.string().trim().maxLength(255).optional(),
    myRole: vine.enum(['CHU_TRI', 'DONG_TAC_GIA'] as const).optional(),
    publicationType: vine.enum(['JOURNAL', 'CONFERENCE', 'BOOK_CHAPTER', 'BOOK'] as const).optional(),
    journalOrConference: vine.string().trim().maxLength(500).optional(),
    publisher: vine.string().trim().maxLength(500).nullable().optional(),
    publishedAt: vine.string().trim().maxLength(10).nullable().optional(),
    published_at: vine.string().trim().maxLength(10).nullable().optional(),
    year: vine.number().optional(),
    volume: vine.string().trim().maxLength(20).optional(),
    issue: vine.string().trim().maxLength(20).optional(),
    pages: vine.string().trim().maxLength(50).optional(),
    rank: vine.enum(['ISI', 'SCOPUS', 'DOMESTIC', 'OTHER'] as const).optional(),
    quartile: vine.enum(['Q1', 'Q2', 'Q3', 'Q4', 'NO_Q'] as const).optional(),
    academicYear: vine
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/)
      .optional(),
    domesticRuleType: vine.enum(['HDGSNN_SCORE', 'CONFERENCE_ISBN'] as const).optional(),
    hdgsnnScore: vine.number().optional(),
    doi: vine.string().trim().maxLength(100).optional(),
    issn: vine.string().trim().maxLength(20).optional(),
    isbn: vine.string().trim().maxLength(20).optional(),
    url: vine.string().trim().url().optional(),
    qRankUrl: vine.string().trim().maxLength(500).nullable().optional(),
    reputableListUrl: vine.string().trim().maxLength(500).nullable().optional(),
    acceptanceGrade: vine.enum(['EXCELLENT', 'PASS_ON_TIME', 'PASS_LATE'] as const).nullable().optional(),
    publicationStatus: vine.enum(['PUBLISHED', 'ACCEPTED', 'UNDER_REVIEW'] as const).optional(),
    source: vine.enum(['INTERNAL', 'GOOGLE_SCHOLAR', 'SCV_DHDN', 'OPENALEX'] as const).optional(),
    sourceId: vine.string().trim().maxLength(100).optional(),
    needsIndexConfirmation: vine.boolean().optional(),
    indexMappedCode: vine.string().trim().maxLength(50).optional(),
    indexMappingReason: vine.string().trim().optional(),
    attachmentUrl: vine.string().trim().optional(),
    verifiedByNcv: vine.boolean().optional(),
  })
)

// Giữ re-export để dùng chung nếu cần
export { createPublicationValidator, updatePublicationValidator }
