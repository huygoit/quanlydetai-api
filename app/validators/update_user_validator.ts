import vine from '@vinejs/vine'
import { USER_ROLES } from '#types/user'

/**
 * Validator cập nhật user: email (optional), fullName, role, isActive optional.
 * Kiểm tra email unique (trừ user hiện tại) trong controller.
 */
export const updateUserValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail().optional(),
    fullName: vine.string().trim().minLength(1).optional(),
    role: vine.enum(USER_ROLES).optional(),
    roleLabel: vine.string().trim().optional(),
    unit: vine.string().trim().optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    isActive: vine.boolean().optional(),
  })
)
