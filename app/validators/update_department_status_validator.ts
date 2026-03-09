import vine from '@vinejs/vine'
import { DEPARTMENT_STATUSES } from '#types/department'

/**
 * Validator cập nhật riêng trạng thái department (PATCH /api/admin/departments/:id/status).
 */
export const updateDepartmentStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(DEPARTMENT_STATUSES),
  })
)
