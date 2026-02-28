import vine from '@vinejs/vine'

/**
 * Validator cập nhật system config (PUT /api/admin/configs/:key).
 */
export const updateConfigValidator = vine.compile(
  vine.object({
    value: vine.string().trim(),
    description: vine.string().trim().maxLength(500).optional(),
  })
)
