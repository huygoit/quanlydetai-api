import vine from '@vinejs/vine'

/** Danh sách status hợp lệ */
const STATUSES = ['ACTIVE', 'INACTIVE'] as const

/**
 * Validator đổi trạng thái hồ sơ cá nhân (PATCH /api/admin/personal-profiles/:id/status).
 */
export const updatePersonalProfileStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(STATUSES),
  })
)
