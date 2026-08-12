import vine from '@vinejs/vine'
import { STAFF_POSITION_STATUSES } from '#types/staff_position'

/**
 * Validator đổi trạng thái chức vụ (PATCH /api/admin/staff-positions/:id/status).
 */
export const updateStaffPositionStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(STAFF_POSITION_STATUSES),
  })
)
