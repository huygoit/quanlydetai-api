/** Trạng thái duyệt kết quả NCKH */
export const PUBLICATION_REVIEW_STATUSES = [
  'NEW',
  'CORRECTION_REQUESTED',
  'CORRECTED',
  'APPROVED',
] as const

export type PublicationReviewStatus = (typeof PUBLICATION_REVIEW_STATUSES)[number]

export const PUBLICATION_REVIEW_STATUS_LABELS: Record<PublicationReviewStatus, string> = {
  NEW: 'Mới',
  CORRECTION_REQUESTED: 'Yêu cầu hiệu chỉnh',
  CORRECTED: 'Đã hiệu chỉnh',
  APPROVED: 'Đã duyệt',
}
