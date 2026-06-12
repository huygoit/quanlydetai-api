import vine from '@vinejs/vine'

/** POST /api/admin/publications/:id/request-correction */
export const requestPublicationCorrectionValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(2000),
  })
)
