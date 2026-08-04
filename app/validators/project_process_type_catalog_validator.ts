import vine from '@vinejs/vine'
import { PROJECT_PROCESS_TYPE_STATUSES } from '#types/project_process_type'

export const projectProcessTypeCatalogQueryValidator = vine.compile(
  vine.object({
    status: vine.enum(PROJECT_PROCESS_TYPE_STATUSES).optional(),
    keyword: vine.string().trim().optional(),
    page: vine.number().min(1).optional(),
    perPage: vine.number().min(1).max(1000).optional(),
    sortBy: vine.enum(['display_order', 'name', 'code']).optional(),
    order: vine.enum(['asc', 'desc']).optional(),
  })
)
