import vine from '@vinejs/vine'
import { DEPARTMENT_TYPES, DEPARTMENT_STATUSES } from '#types/department'

/** Phạm vi lọc preset cho dropdown / hồ sơ khoa học */
export const DEPARTMENT_CATALOG_SCOPES = ['all', 'khoa_phong_ban', 'truong'] as const

/** Cột sắp xếp catalog */
export const DEPARTMENT_CATALOG_SORT_COLUMNS = ['display_order', 'name', 'code'] as const

/**
 * Validator query GET /api/departments và /api/departments/options.
 */
export const departmentCatalogQueryValidator = vine.compile(
  vine.object({
    status: vine.enum(DEPARTMENT_STATUSES).optional(),
    type: vine.enum(DEPARTMENT_TYPES).optional(),
    scope: vine.enum(DEPARTMENT_CATALOG_SCOPES).optional(),
    keyword: vine.string().trim().maxLength(255).optional(),
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(1000).optional(),
    sortBy: vine.enum(DEPARTMENT_CATALOG_SORT_COLUMNS).optional(),
    order: vine.enum(['asc', 'desc'] as const).optional(),
  })
)
