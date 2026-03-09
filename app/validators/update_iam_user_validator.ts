import vine from '@vinejs/vine'

/**
 * Validator cập nhật user IAM (PUT /admin/users/:id).
 */
export const updateIamUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    email: vine.string().email().normalizeEmail().trim().optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    departmentId: vine.number().optional(),
    isActive: vine.boolean().optional(),
    note: vine.string().trim().optional(),
  })
)
