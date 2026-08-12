import vine from '@vinejs/vine'
import { STAFF_POSITION_KINDS, STAFF_POSITION_STATUSES } from '#types/staff_position'

/**
 * Validator cập nhật chức vụ (PUT /api/admin/staff-positions/:id).
 */
export const updateStaffPositionValidator = vine.compile(
  vine.object({
    kind: vine.enum(STAFF_POSITION_KINDS).optional(),
    code: vine.string().trim().minLength(1).maxLength(80).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    displayOrder: vine.number().optional(),
    status: vine.enum(STAFF_POSITION_STATUSES).optional(),
  })
)
