import vine from '@vinejs/vine'

/**
 * Validator tạo user IAM (POST /admin/users).
 */
export const createIamUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255),
    email: vine.string().email().normalizeEmail().trim(),
    phone: vine.string().trim().maxLength(20).optional(),
    departmentId: vine.number().optional(),
    password: vine.string().minLength(8),
    confirmPassword: vine.string().minLength(8).sameAs('password'),
    roleIds: vine.array(vine.number()).optional(),
    isActive: vine.boolean().optional(),
    note: vine.string().trim().optional(),
  })
)
