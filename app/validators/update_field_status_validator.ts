import vine from '@vinejs/vine'
import { FIELD_STATUSES } from '#types/field'

/**
 * Validator cập nhật riêng trạng thái lĩnh vực (PATCH /api/admin/fields/:id/status).
 */
export const updateFieldStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(FIELD_STATUSES),
  })
)
