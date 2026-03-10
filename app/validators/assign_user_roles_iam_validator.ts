import vine from '@vinejs/vine'

/**
 * Validator gán roles cho user (PUT /admin/users/:id/roles).
 * Chấp nhận cả roleIds (camelCase) và role_ids (snake_case).
 */
export const assignUserRolesIamValidator = vine.compile(
  vine.object({
    roleIds: vine.array(vine.number()).optional(),
    role_ids: vine.array(vine.number()).optional(),
  })
)
