import vine from '@vinejs/vine'

/**
 * Validator gán thêm 1 role cho user.
 */
export const assignUserRoleValidator = vine.compile(
  vine.object({
    roleId: vine.number(),
    isActive: vine.boolean().optional(),
    startAt: vine.any().optional(),
    endAt: vine.any().optional(),
  })
)
