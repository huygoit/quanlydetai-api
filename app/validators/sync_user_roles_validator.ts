import vine from '@vinejs/vine'

/**
 * Validator gán lại toàn bộ roles cho user.
 */
export const syncUserRolesValidator = vine.compile(
  vine.object({
    roleIds: vine.array(vine.number()).optional(),
  })
)
