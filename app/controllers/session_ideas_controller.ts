import type { HttpContext } from '@adonisjs/core/http'
import CouncilSession from '#models/council_session'
import SessionIdea from '#models/session_idea'
import Idea from '#models/idea'
import CouncilPermissionService from '#services/council_permission_service'
import { addSessionIdeasValidator } from '#validators/council_validator'

/**
 * Ý tưởng trong phiên: GET list, POST add (batch), DELETE remove.
 */
export default class SessionIdeasController {
  async index({ params, response }: HttpContext) {
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const list = await SessionIdea.query().where('session_id', params.id).orderBy('id', 'asc')
    const data = list.map((si) => ({
      id: si.id,
      ideaId: si.ideaId,
      ideaCode: si.ideaCode,
      ideaTitle: si.ideaTitle,
      ownerName: si.ownerName,
      ownerUnit: si.ownerUnit,
      field: si.field,
      statusSnapshot: si.statusSnapshot,
    }))
    return response.ok({ success: true, data })
  }

  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được thêm ý tưởng.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ thêm được khi phiên DRAFT.' })
    const payload = await request.validateUsing(addSessionIdeasValidator)
    let added = 0
    for (const { ideaId } of payload.ideas) {
      const idea = await Idea.find(ideaId)
      if (!idea) continue
      if (idea.status !== 'APPROVED_INTERNAL') continue
      const exists = await SessionIdea.query().where('session_id', params.id).where('idea_id', ideaId).first()
      if (exists) continue
      await SessionIdea.create({
        sessionId: session.id,
        ideaId: idea.id,
        ideaCode: idea.code,
        ideaTitle: idea.title,
        ownerName: idea.ownerName,
        ownerUnit: idea.ownerUnit,
        field: idea.field,
        statusSnapshot: idea.status,
      })
      added++
    }
    session.ideaCount = session.ideaCount + added
    await session.save()
    const list = await SessionIdea.query().where('session_id', params.id).orderBy('id', 'asc')
    const data = list.map((si) => ({
      id: si.id,
      ideaId: si.ideaId,
      ideaCode: si.ideaCode,
      ideaTitle: si.ideaTitle,
      ownerName: si.ownerName,
      ownerUnit: si.ownerUnit,
      field: si.field,
      statusSnapshot: si.statusSnapshot,
    }))
    return response.ok({ success: true, data, message: `Đã thêm ${added} ý tưởng.` })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được xóa ý tưởng khỏi phiên.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ xóa được khi phiên DRAFT.' })
    const sessionIdeaId = params.sessionIdeaId
    const si = await SessionIdea.query().where('session_id', params.id).where('id', sessionIdeaId).first()
    if (!si) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng trong phiên.' })
    await si.delete()
    session.ideaCount = Math.max(0, session.ideaCount - 1)
    await session.save()
    return response.ok({ success: true, message: 'Đã xóa ý tưởng khỏi phiên.' })
  }
}
