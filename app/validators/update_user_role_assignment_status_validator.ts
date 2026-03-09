import vine from '@vinejs/vine'

/**
 * Validator bật/tắt assignment role.
 */
export const updateUserRoleAssignmentStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean(),
  })
)
