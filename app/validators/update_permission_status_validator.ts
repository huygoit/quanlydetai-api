import vine from '@vinejs/vine'
import { PERMISSION_STATUSES } from '#types/iam'

/**
 * Validator cập nhật trạng thái permission.
 */
export const updatePermissionStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(PERMISSION_STATUSES),
  })
)
