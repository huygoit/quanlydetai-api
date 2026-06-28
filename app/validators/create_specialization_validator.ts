import vine from '@vinejs/vine'
import { SPECIALIZATION_STATUSES } from '#types/specialization'

/**
 * Validator tạo chuyên ngành mới (POST /api/admin/specializations).
 */
export const createSpecializationValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(80),
    name: vine.string().trim().minLength(1).maxLength(255),
    displayOrder: vine.number().optional(),
    status: vine.enum(SPECIALIZATION_STATUSES).optional(),
  })
)
