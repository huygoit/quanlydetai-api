import vine from '@vinejs/vine'
import { SPECIALIZATION_STATUSES } from '#types/specialization'

/**
 * Validator query catalog chuyên ngành (GET /api/specializations, /api/specializations/options).
 */
export const specializationCatalogQueryValidator = vine.compile(
  vine.object({
    status: vine.enum(SPECIALIZATION_STATUSES).optional(),
    keyword: vine.string().trim().optional(),
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(1000).optional(),
    sortBy: vine.enum(['display_order', 'name', 'code']).optional(),
    order: vine.enum(['asc', 'desc']).optional(),
  })
)
