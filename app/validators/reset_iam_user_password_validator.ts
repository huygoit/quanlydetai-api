import vine from '@vinejs/vine'

/**
 * Validator reset password user (PATCH /admin/users/:id/reset-password).
 */
export const resetIamUserPasswordValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(8),
    confirmPassword: vine.string().minLength(8).sameAs('password'),
  })
)
