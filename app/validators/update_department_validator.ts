import vine from '@vinejs/vine'
import { DEPARTMENT_TYPES, DEPARTMENT_STATUSES } from '#types/department'

/**
 * Validator cập nhật department (PUT /api/admin/departments/:id).
 */
export const updateDepartmentValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(50).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    shortName: vine.string().trim().maxLength(100).optional(),
    type: vine.enum(DEPARTMENT_TYPES).optional(),
    displayOrder: vine.number().optional(),
    status: vine.enum(DEPARTMENT_STATUSES).optional(),
    note: vine.string().trim().optional(),
  })
)
