import vine from '@vinejs/vine'
import { SPECIALIZATION_STATUSES } from '#types/specialization'

/**
 * Validator cập nhật riêng trạng thái chuyên ngành (PATCH /api/admin/specializations/:id/status).
 */
export const updateSpecializationStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(SPECIALIZATION_STATUSES),
  })
)
