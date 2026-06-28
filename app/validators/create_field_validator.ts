import vine from '@vinejs/vine'
import { FIELD_STATUSES } from '#types/field'

/**
 * Validator tạo lĩnh vực mới (POST /api/admin/fields).
 */
export const createFieldValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(30),
    name: vine.string().trim().minLength(1).maxLength(200),
    displayOrder: vine.number().optional(),
    status: vine.enum(FIELD_STATUSES).optional(),
  })
)
