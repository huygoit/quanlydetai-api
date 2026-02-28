import vine from '@vinejs/vine'
import { USER_ROLES } from '#types/user'

/**
 * Validator tạo user mới:
 * email (bắt buộc, email), password (bắt buộc, min 6),
 * fullName (bắt buộc), role (bắt buộc, enum).
 * Kiểm tra email unique trong controller.
 */
export const createUserValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(6),
    fullName: vine.string().trim().minLength(1),
    role: vine.enum(USER_ROLES),
    roleLabel: vine.string().trim().optional(),
    unit: vine.string().trim().optional(),
    phone: vine.string().trim().maxLength(20).optional(),
  })
)
