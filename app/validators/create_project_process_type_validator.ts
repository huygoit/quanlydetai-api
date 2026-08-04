import vine from '@vinejs/vine'
import { PROJECT_PROCESS_TYPE_STATUSES } from '#types/project_process_type'

export const createProjectProcessTypeValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(30),
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().maxLength(2000).optional().nullable(),
    displayOrder: vine.number().optional(),
    status: vine.enum(PROJECT_PROCESS_TYPE_STATUSES).optional(),
  })
)
