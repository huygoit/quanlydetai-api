import type { HttpContext } from '@adonisjs/core/http'
import ScientificProfile from '#models/scientific_profile'
import ProfileLanguage from '#models/profile_language'
import { normalizeOptionalHttpUrl } from '#utils/optional_http_url'
import { createProfileLanguageValidator } from '#validators/profile_language_validator'
import { updateProfileLanguageValidator } from '#validators/profile_language_validator'

/**
 * Sub-resource: languages của hồ sơ me (GET/POST /api/profile/me/languages, PUT/DELETE /:id).
 */
export default class ProfileLanguagesController {
  private getParsedBody(request: HttpContext['request']) {
    const body = request.body()
    const toObject = (value: unknown) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
      return {}
    }

    if (typeof body === 'string') {
      const trimmed = String(body).trim()
      if (!trimmed) return {}

      try {
        const once = JSON.parse(trimmed) as unknown
        if (typeof once === 'string') {
          try {
            return toObject(JSON.parse(once))
          } catch {
            return { language: once.trim() }
          }
        }
        return toObject(once)
      } catch {
        return { language: trimmed }
      }
    }

    const parsed = toObject(body)
    if ('certificateUrl' in parsed) {
      parsed.certificateUrl = normalizeOptionalHttpUrl(parsed.certificateUrl)
    }
    if ('certificate_url' in parsed) {
      parsed.certificate_url = normalizeOptionalHttpUrl(parsed.certificate_url)
    }
    return parsed
  }

  private async getMyProfile(userId: number) {
    return ScientificProfile.findBy('user_id', userId)
  }

  async index({ auth, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const list = await ProfileLanguage.query().where('profile_id', profile.id).orderBy('id', 'asc')
    return response.ok({
      success: true,
      data: list.map((l) => ({
        id: l.id,
        language: l.language,
        level: l.level,
        certificate: l.certificate,
        certificateUrl: l.certificateUrl,
        certificate_url: l.certificateUrl,
      })),
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const payload = await createProfileLanguageValidator.validate(this.getParsedBody(request))
    const lang = await ProfileLanguage.create({
      profileId: profile.id,
      language: payload.language,
      level: payload.level ?? null,
      certificate: payload.certificate ?? null,
      certificateUrl: payload.certificateUrl ?? null,
    })
    return response.created({
      success: true,
      data: {
        id: lang.id,
        language: lang.language,
        level: lang.level,
        certificate: lang.certificate,
        certificateUrl: lang.certificateUrl,
        certificate_url: lang.certificateUrl,
      },
    })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const lang = await ProfileLanguage.query().where('id', params.id).where('profile_id', profile.id).first()
    if (!lang) return response.notFound({ success: false, message: 'Không tìm thấy mục ngoại ngữ.' })
    const payload = await updateProfileLanguageValidator.validate(this.getParsedBody(request))
    if (payload.language !== undefined) lang.language = payload.language
    if (payload.level !== undefined) lang.level = payload.level ?? null
    if (payload.certificate !== undefined) lang.certificate = payload.certificate ?? null
    if (payload.certificateUrl !== undefined) lang.certificateUrl = payload.certificateUrl ?? null
    await lang.save()
    return response.ok({
      success: true,
      data: {
        id: lang.id,
        language: lang.language,
        level: lang.level,
        certificate: lang.certificate,
        certificateUrl: lang.certificateUrl,
        certificate_url: lang.certificateUrl,
      },
    })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const lang = await ProfileLanguage.query().where('id', params.id).where('profile_id', profile.id).first()
    if (!lang) return response.notFound({ success: false, message: 'Không tìm thấy mục ngoại ngữ.' })
    await lang.delete()
    return response.ok({ success: true, message: 'Đã xóa.' })
  }
}
