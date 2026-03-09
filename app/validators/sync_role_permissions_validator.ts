import vine from '@vinejs/vine'

/**
 * Validator gán permissions cho role.
 */
export const syncRolePermissionsValidator = vine.compile(
  vine.object({
    permissionIds: vine.array(vine.number()).optional(),
  })
)
