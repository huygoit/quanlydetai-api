import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import ScientificProfile from '#models/scientific_profile'
import ProfileAttachment from '#models/profile_attachment'
import { createAttachmentValidator } from '#validators/publication_validator'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const UPLOAD_DIR = 'profile-attachments'

/**
 * Sub-resource: attachments của hồ sơ me. POST nhận multipart (file + type + name) hoặc JSON (url + type + name).
 */
export default class ProfileAttachmentsController {
  private async getMyProfile(userId: number) {
    return ScientificProfile.findBy('user_id', userId)
  }

  async index({ auth, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const list = await ProfileAttachment.query().where('profile_id', profile.id).orderBy('id', 'desc')
    return response.ok({
      success: true,
      data: list.map((a) => ({ id: a.id, type: a.type, name: a.name, url: a.url, uploadedAt: a.uploadedAt.toISO() })),
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })

    const file = request.file('file')
    let url: string

    if (file) {
      const payload = await request.validateUsing(createAttachmentValidator)
      const dir = path.join(app.appRoot, 'storage', UPLOAD_DIR)
      await fs.mkdir(dir, { recursive: true })
      const ext = path.extname(file.clientName) || ''
      const filename = `${profile.id}-${randomUUID()}${ext}`
      const filepath = path.join(dir, filename)
      await file.move(path.dirname(filepath), { name: filename })
      if (!file.hasErrors) {
        url = `/storage/${UPLOAD_DIR}/${filename}`
      } else {
        return response.badRequest({ success: false, message: 'Tải file thất bại.', errors: file.errors })
      }
      const att = await ProfileAttachment.create({
        profileId: profile.id,
        type: payload.type,
        name: payload.name,
        url,
        uploadedAt: DateTime.now(),
      })
      return response.created({ success: true, data: { id: att.id, type: att.type, name: att.name, url: att.url, uploadedAt: att.uploadedAt.toISO() } })
    }

    const body = request.body()
    const type = body?.type as string | undefined
    const name = body?.name as string | undefined
    const urlBody = body?.url as string | undefined
    if (!type || !name) {
      return response.badRequest({ success: false, message: 'Cần type, name và file (multipart) hoặc url (JSON).' })
    }
    if (!urlBody) {
      return response.badRequest({ success: false, message: 'Khi không gửi file, cần gửi url.' })
    }
    const att = await ProfileAttachment.create({
      profileId: profile.id,
      type: type as 'CV_PDF' | 'DEGREE' | 'CERTIFICATE' | 'OTHER',
      name,
      url: urlBody,
      uploadedAt: DateTime.now(),
    })
    return response.created({ success: true, data: { id: att.id, type: att.type, name: att.name, url: att.url, uploadedAt: att.uploadedAt.toISO() } })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const profile = await this.getMyProfile(auth.use('api').user!.id)
    if (!profile) return response.notFound({ success: false, message: 'Chưa có hồ sơ.' })
    const att = await ProfileAttachment.query().where('id', params.id).where('profile_id', profile.id).first()
    if (!att) return response.notFound({ success: false, message: 'Không tìm thấy file đính kèm.' })
    await att.delete()
    return response.ok({ success: true, message: 'Đã xóa.' })
  }
}
