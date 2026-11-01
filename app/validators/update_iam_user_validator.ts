import vine from '@vinejs/vine'

/**
 * Validator cập nhật user IAM (PUT /admin/users/:id).
 */
export const updateIamUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    email: vine.string().email().normalizeEmail().trim().optional(),
    phone: vine.string().trim().maxLength(20).optional(),
    /** Form quản lý người dùng gửi department_id; API cũ dùng departmentId. */
    departmentId: vine.number().optional(),
    department_id: vine.number().optional(),
    roleIds: vine.array(vine.number()).optional(),
    role_ids: vine.array(vine.number()).optional(),
    isActive: vine.boolean().optional(),
    status: vine.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
    note: vine.string().trim().optional(),
  })
)
