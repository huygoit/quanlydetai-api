import vine from '@vinejs/vine'
import { SPECIALIZATION_STATUSES } from '#types/specialization'

/**
 * Validator cập nhật chuyên ngành (PUT /api/admin/specializations/:id).
 */
export const updateSpecializationValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(80).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    displayOrder: vine.number().optional(),
    status: vine.enum(SPECIALIZATION_STATUSES).optional(),
  })
)
