import vine from '@vinejs/vine'
import { PROJECT_PROCESS_TYPE_STATUSES } from '#types/project_process_type'

export const updateProjectProcessTypeStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(PROJECT_PROCESS_TYPE_STATUSES),
  })
)
