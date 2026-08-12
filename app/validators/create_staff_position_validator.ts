import vine from '@vinejs/vine'
import { STAFF_POSITION_KINDS, STAFF_POSITION_STATUSES } from '#types/staff_position'

/**
 * Validator tạo chức vụ (POST /api/admin/staff-positions).
 */
export const createStaffPositionValidator = vine.compile(
  vine.object({
    kind: vine.enum(STAFF_POSITION_KINDS),
    code: vine.string().trim().minLength(1).maxLength(80),
    name: vine.string().trim().minLength(1).maxLength(255),
    displayOrder: vine.number().optional(),
    status: vine.enum(STAFF_POSITION_STATUSES).optional(),
  })
)
