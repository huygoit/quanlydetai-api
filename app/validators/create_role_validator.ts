import vine from '@vinejs/vine'
import { ROLE_STATUSES } from '#types/iam'

/**
 * Validator tạo role mới.
 */
export const createRoleValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(80),
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
    status: vine.enum(ROLE_STATUSES).optional(),
  })
)
