import vine from '@vinejs/vine'

export const createProfileLanguageValidator = vine.compile(
  vine.object({
    language: vine.string().trim().minLength(1).maxLength(50),
    level: vine.string().trim().maxLength(20).optional(),
    certificate: vine.string().trim().maxLength(100).optional(),
    /** Không dùng `.url()` — xem `scientific_profile_validator` (PUT /profile/me). */
    certificateUrl: vine.string().trim().maxLength(2000).optional(),
  })
)

export const updateProfileLanguageValidator = vine.compile(
  vine.object({
    language: vine.string().trim().minLength(1).maxLength(50).optional(),
    level: vine.string().trim().maxLength(20).optional(),
    certificate: vine.string().trim().maxLength(100).optional(),
    certificateUrl: vine.string().trim().maxLength(2000).optional(),
  })
)
