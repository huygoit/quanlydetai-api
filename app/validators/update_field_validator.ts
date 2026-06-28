import vine from '@vinejs/vine'
import { FIELD_STATUSES } from '#types/field'

/**
 * Validator cập nhật lĩnh vực (PUT /api/admin/fields/:id).
 */
export const updateFieldValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(30).optional(),
    name: vine.string().trim().minLength(1).maxLength(200).optional(),
    displayOrder: vine.number().optional(),
    status: vine.enum(FIELD_STATUSES).optional(),
  })
)
