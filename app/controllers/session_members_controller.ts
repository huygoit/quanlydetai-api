import type { HttpContext } from '@adonisjs/core/http'
import CouncilSession from '#models/council_session'
import SessionMember from '#models/session_member'
import { addSessionMemberValidator } from '#validators/council_validator'

/**
 * Thành viên phiên hội đồng: GET list, POST add, DELETE remove.
 */
export default class SessionMembersController {
  async index({ params, response }: HttpContext) {
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const list = await SessionMember.query().where('session_id', params.id).orderBy('id', 'asc')
    const data = list.map((m) => ({
      id: m.id,
      memberId: m.memberId,
      memberName: m.memberName,
      memberEmail: m.memberEmail,
      roleInCouncil: m.roleInCouncil,
      unit: m.unit,
    }))
    return response.ok({ success: true, data })
  }

  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (user.role !== 'PHONG_KH') return response.forbidden({ success: false, message: 'Chỉ Phòng KH được thêm thành viên.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ thêm được khi phiên DRAFT.' })
    const payload = await request.validateUsing(addSessionMemberValidator)
    const exists = await SessionMember.query().where('session_id', params.id).where('member_id', payload.memberId).first()
    if (exists) return response.badRequest({ success: false, message: 'Thành viên đã có trong phiên.' })
    await SessionMember.create({
      sessionId: session.id,
      memberId: payload.memberId,
      memberName: payload.memberName,
      memberEmail: payload.memberEmail ?? null,
      roleInCouncil: payload.roleInCouncil,
      unit: payload.unit ?? null,
    })
    session.memberCount = session.memberCount + 1
    await session.save()
    const list = await SessionMember.query().where('session_id', params.id).orderBy('id', 'asc')
    const data = list.map((m) => ({ id: m.id, memberId: m.memberId, memberName: m.memberName, memberEmail: m.memberEmail, roleInCouncil: m.roleInCouncil, unit: m.unit }))
    return response.ok({ success: true, data })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (user.role !== 'PHONG_KH') return response.forbidden({ success: false, message: 'Chỉ Phòng KH được xóa thành viên.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ xóa được khi phiên DRAFT.' })
    const memberId = params.memberId
    const member = await SessionMember.query().where('session_id', params.id).where('member_id', memberId).first()
    if (!member) return response.notFound({ success: false, message: 'Không tìm thấy thành viên trong phiên.' })
    await member.delete()
    session.memberCount = Math.max(0, session.memberCount - 1)
    await session.save()
    return response.ok({ success: true, message: 'Đã xóa thành viên.' })
  }
}
