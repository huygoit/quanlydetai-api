import vine from '@vinejs/vine'
import { FIELD_STATUSES } from '#types/field'

/**
 * Validator query catalog lĩnh vực (GET /api/fields, /api/fields/options).
 */
export const fieldCatalogQueryValidator = vine.compile(
  vine.object({
    status: vine.enum(FIELD_STATUSES).optional(),
    keyword: vine.string().trim().optional(),
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(1000).optional(),
    sortBy: vine.enum(['display_order', 'name', 'code']).optional(),
    order: vine.enum(['asc', 'desc']).optional(),
  })
)
