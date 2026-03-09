import vine from '@vinejs/vine'
import { PERMISSION_STATUSES, PERMISSION_CODE_REGEX } from '#types/iam'

/**
 * Validator tạo permission mới.
 * Code phải đúng format module.action.
 */
export const createPermissionValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(100).regex(PERMISSION_CODE_REGEX),
    name: vine.string().trim().minLength(1).maxLength(255),
    module: vine.string().trim().minLength(1).maxLength(80),
    action: vine.string().trim().minLength(1).maxLength(80),
    description: vine.string().trim().optional(),
    status: vine.enum(PERMISSION_STATUSES).optional(),
  })
)
