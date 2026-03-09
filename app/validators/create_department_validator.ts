import vine from '@vinejs/vine'
import { DEPARTMENT_TYPES, DEPARTMENT_STATUSES } from '#types/department'

/**
 * Validator tạo department mới (POST /api/admin/departments).
 */
export const createDepartmentValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(50),
    name: vine.string().trim().minLength(1).maxLength(255),
    shortName: vine.string().trim().maxLength(100).optional(),
    type: vine.enum(DEPARTMENT_TYPES),
    displayOrder: vine.number().optional(),
    status: vine.enum(DEPARTMENT_STATUSES).optional(),
    note: vine.string().trim().optional(),
  })
)
