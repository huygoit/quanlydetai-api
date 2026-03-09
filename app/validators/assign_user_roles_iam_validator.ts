import vine from '@vinejs/vine'

/**
 * Validator gán roles cho user (PUT /admin/users/:id/roles).
 */
export const assignUserRolesIamValidator = vine.compile(
  vine.object({
    roleIds: vine.array(vine.number()).optional(),
  })
)
