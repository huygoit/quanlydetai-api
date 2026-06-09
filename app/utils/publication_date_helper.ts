import { DateTime } from 'luxon'

export type PublicationDatePayload = {
  publishedAt?: string | null
  published_at?: string | null
  year?: number | null
}

/** Ngày xuất bản tối đa: cuối năm (năm hiện tại + 1). */
export function maxAllowedPublishedAt(): DateTime {
  return DateTime.local().plus({ years: 1 }).endOf('year').startOf('day')
}

export function parsePublishedAtIso(raw: string | null | undefined): DateTime | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s) return null

  const dt = DateTime.fromISO(s, { zone: 'local' })
  if (!dt.isValid) {
    throw new Error('INVALID_PUBLISHED_AT')
  }
  const day = dt.startOf('day')
  if (day > maxAllowedPublishedAt()) {
    throw new Error('PUBLISHED_AT_FUTURE')
  }
  return day
}

export function hasPublishedAtInPayload(payload: PublicationDatePayload): boolean {
  return payload.publishedAt !== undefined || payload.published_at !== undefined
}

/** Tạo mới: publishedAt ưu tiên; year tự sinh từ ngày nếu có publishedAt. */
export function resolvePublicationDatesForCreate(payload: PublicationDatePayload): {
  publishedAt: DateTime | null
  year: number | null
} {
  if (hasPublishedAtInPayload(payload)) {
    const publishedAt = parsePublishedAtIso(payload.publishedAt ?? payload.published_at ?? null)
    return {
      publishedAt,
      year: publishedAt ? publishedAt.year : (payload.year ?? null),
    }
  }
  return {
    publishedAt: null,
    year: payload.year ?? null,
  }
}

/** Cập nhật: chỉ đụng field gửi lên; publishedAt có thì year theo năm ngày. */
export function resolvePublicationDatesForUpdate(
  payload: PublicationDatePayload
): { publishedAt?: DateTime | null; year?: number | null } {
  const updates: { publishedAt?: DateTime | null; year?: number | null } = {}

  if (hasPublishedAtInPayload(payload)) {
    const publishedAt = parsePublishedAtIso(payload.publishedAt ?? payload.published_at ?? null)
    updates.publishedAt = publishedAt
    if (publishedAt) {
      updates.year = publishedAt.year
    } else if (payload.year !== undefined) {
      updates.year = payload.year ?? null
    }
  } else if (payload.year !== undefined) {
    updates.year = payload.year ?? null
  }

  return updates
}

export function formatPublishedAtForResponse(publishedAt: DateTime | null): string | null {
  return publishedAt ? publishedAt.toISODate() : null
}

/**
 * Biểu thức SQL ngày xuất bản hiệu lực khi lọc khoảng:
 * ưu tiên published_at, fallback 01/01 của year (khớp FE layPublishedAtTuApi).
 * Cả hai đều null → biểu thức null → bản ghi bị loại khỏi lọc ngày.
 */
export const PUBLICATION_EFFECTIVE_DATE_EXPR =
  'COALESCE(published_at::date, CASE WHEN year IS NOT NULL THEN make_date(year, 1, 1) END)'
