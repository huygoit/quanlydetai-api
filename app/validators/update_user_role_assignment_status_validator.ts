import vine from '@vinejs/vine'

/**
 * Validator bật/tắt assignment role. Chấp nhận isActive hoặc is_active.
 */
export const updateUserRoleAssignmentStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean().optional(),
    is_active: vine.boolean().optional(),
  })
)
