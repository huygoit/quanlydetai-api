import vine from '@vinejs/vine'

/**
 * Validator cho đăng ký tài khoản:
 * - email: bắt buộc, đúng format, chuẩn hóa (trim, lowercase), kiểm tra unique trong controller
 * - password: bắt buộc, tối thiểu 8 ký tự
 * - confirmPassword: bắt buộc, phải khớp với password (sameAs)
 */
export const authRegisterValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail().trim(),
    password: vine.string().minLength(8),
    confirmPassword: vine.string().minLength(8).sameAs('password'),
  })
)
