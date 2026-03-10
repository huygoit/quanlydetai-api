import vine from '@vinejs/vine'

/**
 * Validator gán permissions cho role (PUT /admin/roles/:id/permissions).
 * Chấp nhận cả permissionIds (camelCase) và permission_ids (snake_case).
 */
export const syncRolePermissionsValidator = vine.compile(
  vine.object({
    permissionIds: vine.array(vine.number()).optional(),
    permission_ids: vine.array(vine.number()).optional(),
  })
)
