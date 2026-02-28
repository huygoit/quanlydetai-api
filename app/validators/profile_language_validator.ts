import vine from '@vinejs/vine'

export const createProfileLanguageValidator = vine.compile(
  vine.object({
    language: vine.string().trim().minLength(1).maxLength(50),
    level: vine.string().trim().maxLength(20).optional(),
    certificate: vine.string().trim().maxLength(100).optional(),
    certificateUrl: vine.string().trim().url().optional(),
  })
)

export const updateProfileLanguageValidator = vine.compile(
  vine.object({
    language: vine.string().trim().minLength(1).maxLength(50).optional(),
    level: vine.string().trim().maxLength(20).optional(),
    certificate: vine.string().trim().maxLength(100).optional(),
    certificateUrl: vine.string().trim().url().optional(),
  })
)
