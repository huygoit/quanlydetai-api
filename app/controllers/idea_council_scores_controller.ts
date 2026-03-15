import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import CouncilSession from '#models/council_session'
import SessionMember from '#models/session_member'
import SessionIdea from '#models/session_idea'
import IdeaCouncilScore from '#models/idea_council_score'
import CouncilPermissionService from '#services/council_permission_service'
import { saveScoreValidator } from '#validators/council_validator'
import { calculateWeightedScore, THRESHOLD_SCORE } from '#services/council_score_service'

/**
 * Phiếu chấm điểm: my-score, save, submit, list (PHONG_KH/ADMIN), result, results, stats.
 */
export default class IdeaCouncilScoresController {
  private serializeScore(s: IdeaCouncilScore) {
    return {
      id: s.id,
      sessionId: s.sessionId,
      ideaId: s.ideaId,
      councilMemberId: s.councilMemberId,
      councilMemberName: s.councilMemberName,
      councilRole: s.councilRole,
      noveltyScore: Number(s.noveltyScore),
      noveltyComment: s.noveltyComment,
      feasibilityScore: Number(s.feasibilityScore),
      feasibilityComment: s.feasibilityComment,
      alignmentScore: Number(s.alignmentScore),
      alignmentComment: s.alignmentComment,
      authorCapacityScore: Number(s.authorCapacityScore),
      authorCapacityComment: s.authorCapacityComment,
      weightedScore: Number(s.weightedScore),
      generalComment: s.generalComment,
      submitted: s.submitted,
      submittedAt: s.submittedAt ? s.submittedAt.toISO() : null,
      createdAt: s.createdAt.toISO(),
      updatedAt: s.updatedAt.toISO(),
    }
  }

  async myScore({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await CouncilSession.find(params.sessionId)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const member = await SessionMember.query()
      .where('session_id', params.sessionId)
      .where('member_id', user.id)
      .first()
    if (!member) return response.forbidden({ success: false, message: 'Bạn không phải thành viên phiên này.' })
    const score = await IdeaCouncilScore.query()
      .where('session_id', params.sessionId)
      .where('idea_id', params.ideaId)
      .where('council_member_id', user.id)
      .first()
    if (!score) return response.ok({ success: true, data: null })
    return response.ok({ success: true, data: this.serializeScore(score) })
  }

  async saveScore({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await CouncilSession.find(params.sessionId)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'OPEN') return response.badRequest({ success: false, message: 'Chỉ chấm điểm khi phiên OPEN.' })
    const member = await SessionMember.query().where('session_id', params.sessionId).where('member_id', user.id).first()
    if (!member) return response.forbidden({ success: false, message: 'Bạn không phải thành viên phiên này.' })
    const si = await SessionIdea.query().where('session_id', params.sessionId).where('idea_id', params.ideaId).first()
    if (!si) return response.notFound({ success: false, message: 'Ý tưởng không thuộc phiên này.' })
    const payload = await request.validateUsing(saveScoreValidator)
    const weighted = calculateWeightedScore({
      novelty: payload.noveltyScore,
      feasibility: payload.feasibilityScore,
      alignment: payload.alignmentScore,
      authorCapacity: payload.authorCapacityScore,
    })
    let score = await IdeaCouncilScore.query()
      .where('session_id', params.sessionId)
      .where('idea_id', params.ideaId)
      .where('council_member_id', user.id)
      .first()
    if (score) {
      if (score.submitted) return response.badRequest({ success: false, message: 'Đã nộp phiếu, không thể sửa.' })
      score.noveltyScore = payload.noveltyScore
      score.noveltyComment = payload.noveltyComment ?? null
      score.feasibilityScore = payload.feasibilityScore
      score.feasibilityComment = payload.feasibilityComment ?? null
      score.alignmentScore = payload.alignmentScore
      score.alignmentComment = payload.alignmentComment ?? null
      score.authorCapacityScore = payload.authorCapacityScore
      score.authorCapacityComment = payload.authorCapacityComment ?? null
      score.weightedScore = weighted
      score.generalComment = payload.generalComment ?? null
      await score.save()
    } else {
      score = await IdeaCouncilScore.create({
        sessionId: session.id,
        ideaId: params.ideaId,
        councilMemberId: user.id,
        councilMemberName: user.fullName,
        councilRole: member.roleInCouncil,
        noveltyScore: payload.noveltyScore,
        noveltyComment: payload.noveltyComment ?? null,
        feasibilityScore: payload.feasibilityScore,
        feasibilityComment: payload.feasibilityComment ?? null,
        alignmentScore: payload.alignmentScore,
        alignmentComment: payload.alignmentComment ?? null,
        authorCapacityScore: payload.authorCapacityScore,
        authorCapacityComment: payload.authorCapacityComment ?? null,
        weightedScore: weighted,
        generalComment: payload.generalComment ?? null,
        submitted: false,
      })
    }
    return response.ok({ success: true, data: this.serializeScore(score) })
  }

  /** POST /:sessionId/ideas/:ideaId/submit - Nộp phiếu chấm của tôi cho ý tưởng (frontend gọi theo ideaId) */
  async submitMyScore({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await CouncilSession.find(params.sessionId)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'OPEN') return response.badRequest({ success: false, message: 'Chỉ nộp phiếu khi phiên OPEN.' })
    const score = await IdeaCouncilScore.query()
      .where('session_id', params.sessionId)
      .where('idea_id', params.ideaId)
      .where('council_member_id', user.id)
      .first()
    if (!score) return response.notFound({ success: false, message: 'Chưa có phiếu chấm. Vui lòng lưu nháp trước.' })
    if (score.submitted) return response.badRequest({ success: false, message: 'Phiếu đã nộp.' })
    score.submitted = true
    score.submittedAt = DateTime.now()
    await score.save()
    return response.ok({ success: true, message: 'Đã nộp phiếu.', data: this.serializeScore(score) })
  }

  async submitScore({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await CouncilSession.find(params.sessionId)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'OPEN') return response.badRequest({ success: false, message: 'Chỉ nộp phiếu khi phiên OPEN.' })
    const score = await IdeaCouncilScore.query()
      .where('session_id', params.sessionId)
      .where('id', params.scoreId)
      .first()
    if (!score) return response.notFound({ success: false, message: 'Không tìm thấy phiếu.' })
    if (score.councilMemberId !== user.id) return response.forbidden({ success: false, message: 'Chỉ được nộp phiếu của mình.' })
    if (score.submitted) return response.badRequest({ success: false, message: 'Phiếu đã nộp.' })
    score.submitted = true
    score.submittedAt = DateTime.now()
    await score.save()
    return response.ok({ success: true, message: 'Đã nộp phiếu.', data: this.serializeScore(score) })
  }

  async listScores({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ người có quyền council.view/council.create xem được danh sách phiếu.' })
    const session = await CouncilSession.find(params.sessionId)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const list = await IdeaCouncilScore.query()
      .where('session_id', params.sessionId)
      .where('idea_id', params.ideaId)
      .orderBy('id', 'asc')
    const data = list.map((s) => this.serializeScore(s))
    return response.ok({ success: true, data })
  }

  async result({ params, response }: HttpContext) {
    const session = await CouncilSession.find(params.sessionId)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const si = await SessionIdea.query().where('session_id', params.sessionId).where('idea_id', params.ideaId).first()
    if (!si) return response.notFound({ success: false, message: 'Ý tưởng không thuộc phiên này.' })
    const scores = await IdeaCouncilScore.query()
      .where('session_id', params.sessionId)
      .where('idea_id', params.ideaId)
      .where('submitted', true)
    const n = scores.length
    if (n === 0) {
      return response.ok({
        success: true,
        data: {
          sessionId: session.id,
          ideaId: si.ideaId,
          ideaCode: si.ideaCode,
          ideaTitle: si.ideaTitle,
          avgWeightedScore: null,
          avgNoveltyScore: null,
          avgFeasibilityScore: null,
          avgAlignmentScore: null,
          avgAuthorCapacityScore: null,
          submittedCount: 0,
          memberCount: session.memberCount,
          recommendation: null,
          thresholdScore: THRESHOLD_SCORE,
        },
      })
    }
    const avg = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
    const weightedArr = scores.map((s) => Number(s.weightedScore))
    const noveltyArr = scores.map((s) => Number(s.noveltyScore))
    const feasibilityArr = scores.map((s) => Number(s.feasibilityScore))
    const alignmentArr = scores.map((s) => Number(s.alignmentScore))
    const authorArr = scores.map((s) => Number(s.authorCapacityScore))
    const avgWeighted = avg(weightedArr)
    const recommendation = avgWeighted >= THRESHOLD_SCORE ? 'PROPOSE_ORDER' : 'NOT_PROPOSE'
    return response.ok({
      success: true,
      data: {
        sessionId: session.id,
        ideaId: si.ideaId,
        ideaCode: si.ideaCode,
        ideaTitle: si.ideaTitle,
        avgWeightedScore: avgWeighted,
        avgNoveltyScore: avg(noveltyArr),
        avgFeasibilityScore: avg(feasibilityArr),
        avgAlignmentScore: avg(alignmentArr),
        avgAuthorCapacityScore: avg(authorArr),
        submittedCount: n,
        memberCount: session.memberCount,
        recommendation,
        thresholdScore: THRESHOLD_SCORE,
      },
    })
  }

  async results({ params, response }: HttpContext) {
    const session = await CouncilSession.find(params.sessionId)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const sessionIdeas = await SessionIdea.query().where('session_id', params.sessionId)
    const data: Array<Record<string, unknown>> = []
    for (const si of sessionIdeas) {
      const scores = await IdeaCouncilScore.query()
        .where('session_id', params.sessionId)
        .where('idea_id', si.ideaId)
        .where('submitted', true)
      const n = scores.length
      if (n === 0) {
        data.push({
          sessionId: session.id,
          ideaId: si.ideaId,
          ideaCode: si.ideaCode,
          ideaTitle: si.ideaTitle,
          avgWeightedScore: null,
          avgNoveltyScore: null,
          avgFeasibilityScore: null,
          avgAlignmentScore: null,
          avgAuthorCapacityScore: null,
          submittedCount: 0,
          memberCount: session.memberCount,
          recommendation: null,
          thresholdScore: THRESHOLD_SCORE,
        })
        continue
      }
      const avg = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
      const avgWeighted = avg(scores.map((s) => Number(s.weightedScore)))
      data.push({
        sessionId: session.id,
        ideaId: si.ideaId,
        ideaCode: si.ideaCode,
        ideaTitle: si.ideaTitle,
        avgWeightedScore: avgWeighted,
        avgNoveltyScore: avg(scores.map((s) => Number(s.noveltyScore))),
        avgFeasibilityScore: avg(scores.map((s) => Number(s.feasibilityScore))),
        avgAlignmentScore: avg(scores.map((s) => Number(s.alignmentScore))),
        avgAuthorCapacityScore: avg(scores.map((s) => Number(s.authorCapacityScore))),
        submittedCount: n,
        memberCount: session.memberCount,
        recommendation: avgWeighted >= THRESHOLD_SCORE ? 'PROPOSE_ORDER' : 'NOT_PROPOSE',
        thresholdScore: THRESHOLD_SCORE,
      })
    }
    return response.ok({ success: true, data })
  }

  async stats({ params, response }: HttpContext) {
    const session = await CouncilSession.find(params.sessionId)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const totalIdeas = session.ideaCount
    const totalMembers = session.memberCount
    const totalExpectedScores = totalIdeas * totalMembers
    const submittedList = await IdeaCouncilScore.query()
      .where('session_id', params.sessionId)
      .where('submitted', true)
    const submittedCount = submittedList.length
    const pendingScores = Math.max(0, totalExpectedScores - submittedCount)
    const completionRate = totalExpectedScores > 0 ? Math.round((submittedCount / totalExpectedScores) * 100) : 0
    return response.ok({
      success: true,
      data: {
        totalIdeas,
        totalMembers,
        totalExpectedScores,
        submittedScores: submittedCount,
        pendingScores,
        completionRate,
      },
    })
  }
}
