import vine from '@vinejs/vine'
import { PERMISSION_STATUSES, PERMISSION_CODE_REGEX } from '#types/iam'

/**
 * Validator cập nhật permission.
 */
export const updatePermissionValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(100).regex(PERMISSION_CODE_REGEX).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    module: vine.string().trim().minLength(1).maxLength(80).optional(),
    action: vine.string().trim().minLength(1).maxLength(80).optional(),
    description: vine.string().trim().optional(),
    status: vine.enum(PERMISSION_STATUSES).optional(),
  })
)
