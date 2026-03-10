import vine from '@vinejs/vine'

/**
 * Validator gán thêm 1 role cho user (POST /api/admin/users/:id/roles).
 * Chấp nhận cả camelCase và snake_case.
 */
export const assignUserRoleValidator = vine.compile(
  vine.object({
    roleId: vine.number().optional(),
    role_id: vine.number().optional(),
    isActive: vine.boolean().optional(),
    is_active: vine.boolean().optional(),
    startAt: vine.any().optional(),
    start_at: vine.any().optional(),
    endAt: vine.any().optional(),
    end_at: vine.any().optional(),
  })
)
