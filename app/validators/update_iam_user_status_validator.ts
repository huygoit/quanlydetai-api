import vine from '@vinejs/vine'

/**
 * Validator đổi trạng thái user (PATCH /admin/users/:id/status).
 */
export const updateIamUserStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean(),
  })
)
