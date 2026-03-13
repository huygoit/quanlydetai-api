import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import CouncilSession from '#models/council_session'
import SessionMember from '#models/session_member'
import SessionIdea from '#models/session_idea'
import IdeaCouncilScore from '#models/idea_council_score'
import Idea from '#models/idea'
import NotificationService from '#services/notification_service'
import CouncilPermissionService from '#services/council_permission_service'
import { createCouncilSessionValidator } from '#validators/council_validator'
import { updateCouncilSessionValidator } from '#validators/council_validator'

/**
 * API phiên hội đồng: CRUD, open, close, publish.
 */
export default class CouncilSessionsController {
  private serializeSession(s: CouncilSession) {
    return {
      id: s.id,
      code: s.code,
      title: s.title,
      year: s.year,
      meetingDate: s.meetingDate ? s.meetingDate.toISODate() : null,
      location: s.location,
      status: s.status,
      createdById: s.createdById,
      createdByName: s.createdByName,
      memberCount: s.memberCount,
      ideaCount: s.ideaCount,
      note: s.note,
      createdAt: s.createdAt.toISO(),
      updatedAt: s.updatedAt.toISO(),
    }
  }

  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const year = request.input('year', '')
    const status = request.input('status', '')
    const keyword = request.input('keyword', '')

    const q = CouncilSession.query().orderBy('updated_at', 'desc')
    if (year) q.where('year', year)
    if (status) q.where('status', status)
    if (keyword) q.where((b) => b.whereILike('title', `%${keyword}%`).orWhereILike('code', `%${keyword}%`))
    const paginated = await q.paginate(page, perPage)
    const data = paginated.all().map((s) => this.serializeSession(s))
    return response.ok({
      success: true,
      data,
      meta: { total: paginated.total, currentPage: paginated.currentPage, perPage: paginated.perPage, lastPage: paginated.lastPage },
    })
  }

  async show({ params, response }: HttpContext) {
    const session = await CouncilSession.query()
      .where('id', params.id)
      .preload('members')
      .preload('sessionIdeas')
      .first()
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên hội đồng.' })
    const members = (session.members as SessionMember[]).map((m) => ({
      id: m.id,
      memberId: m.memberId,
      memberName: m.memberName,
      memberEmail: m.memberEmail,
      roleInCouncil: m.roleInCouncil,
      unit: m.unit,
    }))
    const ideas = (session.sessionIdeas as SessionIdea[]).map((si) => ({
      id: si.id,
      ideaId: si.ideaId,
      ideaCode: si.ideaCode,
      ideaTitle: si.ideaTitle,
      ownerName: si.ownerName,
      ownerUnit: si.ownerUnit,
      field: si.field,
      statusSnapshot: si.statusSnapshot,
    }))
    return response.ok({
      success: true,
      data: { ...this.serializeSession(session), members, ideas },
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được tạo phiên.' })
    const payload = await request.validateUsing(createCouncilSessionValidator)
    const code = await CouncilSession.generateCode()
    const session = await CouncilSession.create({
      code,
      title: payload.title,
      year: payload.year,
      meetingDate: payload.meetingDate ? DateTime.fromISO(payload.meetingDate) : null,
      location: payload.location ?? null,
      note: payload.note ?? null,
      status: 'DRAFT',
      createdById: user.id,
      createdByName: user.fullName,
      memberCount: 0,
      ideaCount: 0,
    })
    return response.created({ success: true, data: this.serializeSession(session) })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được sửa.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ sửa được khi trạng thái DRAFT.' })
    const payload = await request.validateUsing(updateCouncilSessionValidator)
    if (payload.title !== undefined) session.title = payload.title
    if (payload.year !== undefined) session.year = payload.year
    if (payload.meetingDate !== undefined) session.meetingDate = payload.meetingDate ? DateTime.fromISO(payload.meetingDate) : null
    if (payload.location !== undefined) session.location = payload.location ?? null
    if (payload.note !== undefined) session.note = payload.note ?? null
    await session.save()
    return response.ok({ success: true, data: this.serializeSession(session) })
  }

  async open({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được mở phiên.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ mở được khi trạng thái DRAFT.' })
    if (session.memberCount < 1) return response.badRequest({ success: false, message: 'Cần ít nhất 1 thành viên.' })
    if (session.ideaCount < 1) return response.badRequest({ success: false, message: 'Cần ít nhất 1 ý tưởng.' })
    session.status = 'OPEN'
    await session.save()
    return response.ok({ success: true, message: 'Đã mở phiên.', data: this.serializeSession(session) })
  }

  async close({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được đóng phiên.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'OPEN') return response.badRequest({ success: false, message: 'Chỉ đóng được khi trạng thái OPEN.' })

    const sessionIdeas = await SessionIdea.query().where('session_id', session.id)
    let proposedCount = 0
    let rejectedCount = 0

    for (const si of sessionIdeas) {
      const scores = await IdeaCouncilScore.query()
        .where('session_id', session.id)
        .where('idea_id', si.ideaId)
        .where('submitted', true)
      if (scores.length === 0) continue

      const n = scores.length
      const avgWeighted = scores.reduce((sum, s) => sum + Number(s.weightedScore), 0) / n
      const avgNovelty = scores.reduce((sum, s) => sum + Number(s.noveltyScore), 0) / n
      const avgFeasibility = scores.reduce((sum, s) => sum + Number(s.feasibilityScore), 0) / n
      const avgAlignment = scores.reduce((sum, s) => sum + Number(s.alignmentScore), 0) / n
      const avgAuthorCapacity = scores.reduce((sum, s) => sum + Number(s.authorCapacityScore), 0) / n

      const recommendation = avgWeighted >= 7.0 ? 'PROPOSE_ORDER' : 'NOT_PROPOSE'
      const idea = await Idea.findOrFail(si.ideaId)
      idea.councilSessionId = session.id
      idea.councilAvgWeightedScore = Math.round(avgWeighted * 100) / 100
      idea.councilAvgNoveltyScore = Math.round(avgNovelty * 100) / 100
      idea.councilAvgFeasibilityScore = Math.round(avgFeasibility * 100) / 100
      idea.councilAvgAlignmentScore = Math.round(avgAlignment * 100) / 100
      idea.councilAvgAuthorCapacityScore = Math.round(avgAuthorCapacity * 100) / 100
      idea.councilSubmittedCount = n
      idea.councilMemberCount = session.memberCount
      idea.councilRecommendation = recommendation
      idea.councilScoredAt = DateTime.now()

      if (recommendation === 'PROPOSE_ORDER') {
        idea.status = 'PROPOSED_FOR_ORDER'
        proposedCount++
      } else {
        idea.status = 'REJECTED'
        idea.rejectedStage = 'HOI_DONG_DE_XUAT'
        idea.rejectedReason = `Điểm trung bình ${avgWeighted.toFixed(2)}/10 không đạt ngưỡng 7.0`
        idea.rejectedByRole = 'HOI_DONG'
        idea.rejectedAt = DateTime.now()
        rejectedCount++
      }
      await idea.save()
      await NotificationService.notifyIdeaStatusChanged(idea.ownerId, idea.code, idea.status, idea.id)
    }

    session.status = 'CLOSED'
    await session.save()
    return response.ok({ success: true, data: { proposedCount, rejectedCount }, message: 'Đã đóng phiên.' })
  }

  async publish({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được công bố.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'CLOSED') return response.badRequest({ success: false, message: 'Chỉ công bố được khi trạng thái CLOSED.' })
    session.status = 'PUBLISHED'
    await session.save()
    return response.ok({ success: true, message: 'Đã công bố kết quả.', data: this.serializeSession(session) })
  }
}
