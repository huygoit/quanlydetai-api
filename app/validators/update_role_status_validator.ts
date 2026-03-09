import vine from '@vinejs/vine'
import { ROLE_STATUSES } from '#types/iam'

/**
 * Validator cập nhật trạng thái role.
 */
export const updateRoleStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(ROLE_STATUSES),
  })
)
