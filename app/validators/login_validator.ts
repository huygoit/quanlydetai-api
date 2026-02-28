import vine from '@vinejs/vine'

/**
 * Validator cho đăng nhập: email (bắt buộc, đúng format), password (bắt buộc, tối thiểu 6 ký tự)
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .email()
      .normalizeEmail(),
    password: vine.string().minLength(6),
  })
)
