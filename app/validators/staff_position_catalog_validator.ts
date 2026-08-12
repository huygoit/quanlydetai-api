import vine from '@vinejs/vine'
import { STAFF_POSITION_KINDS, STAFF_POSITION_STATUSES } from '#types/staff_position'

/**
 * Validator query catalog chức vụ.
 */
export const staffPositionCatalogQueryValidator = vine.compile(
  vine.object({
    kind: vine.enum(STAFF_POSITION_KINDS).optional(),
    status: vine.enum(STAFF_POSITION_STATUSES).optional(),
    keyword: vine.string().trim().optional(),
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(1000).optional(),
    sortBy: vine.enum(['display_order', 'name', 'code', 'kind']).optional(),
    order: vine.enum(['asc', 'desc']).optional(),
  })
)
