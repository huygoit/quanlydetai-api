import vine from '@vinejs/vine'
import { ROLE_STATUSES } from '#types/iam'

/**
 * Validator cập nhật role.
 */
export const updateRoleValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(80).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    status: vine.enum(ROLE_STATUSES).optional(),
  })
)
