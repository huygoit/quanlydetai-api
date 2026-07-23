import type { HttpContext } from '@adonisjs/core/http'
import CallForProposal from '#models/call_for_proposal'
import CallForProposalAudit from '#models/call_for_proposal_audit'
import CallForProposalService from '#services/call_for_proposal_service'
import {
  createCfpValidator,
  updateCfpValidator,
  returnCfpValidator,
  publishCfpValidator,
  extendCfpValidator,
} from '#validators/call_for_proposal_validator'
import type { ProjectProposalLevel } from '#models/project_proposal'

function mapServiceError(response: HttpContext['response'], e: unknown) {
  const code = e instanceof Error ? e.message : String(e)
  const messages: Record<string, string> = {
    INVALID_DEADLINE: 'Ngày hạn nộp không hợp lệ.',
    DEADLINE_TOO_SOON: 'Thời hạn nộp hồ sơ phải lớn hơn ngày hiện tại ít nhất 10 ngày.',
    NOT_EDITABLE: 'Chỉ được sửa thông báo ở trạng thái Nháp hoặc Bị trả về.',
    INVALID_STATUS: 'Trạng thái hiện tại không cho phép thao tác này.',
    INVALID_DOC_DATE: 'Ngày phát hành văn bản không hợp lệ.',
    NO_OPEN_PERIOD: 'Không có kỳ tiếp nhận đang mở.',
    NO_PERIOD: 'Thông báo chưa có kỳ tiếp nhận.',
    DEADLINE_NOT_LATER: 'Ngày gia hạn phải sau hạn hiện tại.',
    ALREADY_CLOSED: 'Kỳ đã đóng.',
  }
  if (messages[code]) {
    return response.unprocessableEntity({ success: false, message: messages[code] })
  }
  throw e
}

export default class CallForProposalsController {
  async index({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const rows = await CallForProposalService.listForUser(user.id, {
      status: request.input('status'),
      periodLabel: request.input('period_label') || request.input('periodLabel'),
      keyword: request.input('keyword'),
    })
    return response.ok({
      success: true,
      data: rows.map((r) => CallForProposalService.serialize(r)),
    })
  }

  async published({ response }: HttpContext) {
    const rows = await CallForProposal.query()
      .where('status', 'PUBLISHED')
      .preload('submissionPeriod')
      .orderBy('published_at', 'desc')
    return response.ok({
      success: true,
      data: rows.map((r) => CallForProposalService.serialize(r, { includePeriod: true })),
    })
  }

  async publishedShow({ params, response }: HttpContext) {
    const cfp = await CallForProposal.query()
      .where('id', params.id)
      .where('status', 'PUBLISHED')
      .preload('submissionPeriod')
      .first()
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo đã phát hành.' })
    }
    return response.ok({
      success: true,
      data: CallForProposalService.serialize(cfp, { includePeriod: true }),
    })
  }

  async activePeriod({ request, response }: HttpContext) {
    const level = String(request.input('level', '')).trim() as ProjectProposalLevel
    const allowed = ['CO_SO', 'TRUONG', 'BO', 'NHA_NUOC']
    if (!allowed.includes(level)) {
      return response.badRequest({ success: false, message: 'level không hợp lệ.' })
    }
    const found = await CallForProposalService.findActivePeriodForLevel(level)
    if (!found) {
      return response.ok({ success: true, data: null })
    }
    return response.ok({
      success: true,
      data: {
        callForProposalId: Number(found.callForProposal.id),
        title: found.callForProposal.title,
        periodId: Number(found.period.id),
        deadlineAt: found.period.deadlineAt.toISO(),
        levels: found.callForProposal.levels,
      },
    })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.query()
      .where('id', params.id)
      .preload('creator')
      .preload('submissionPeriod')
      .preload('audits', (q) => q.preload('actor').orderBy('id', 'desc').limit(30))
      .first()
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    const canManage = await CallForProposalService.userCanManageList(user.id)
    if (!canManage && cfp.status !== 'PUBLISHED') {
      return response.forbidden({ success: false, message: 'Bạn không có quyền xem thông báo này.' })
    }
    return response.ok({
      success: true,
      data: CallForProposalService.serialize(cfp, { includePeriod: true, includeAudits: true }),
    })
  }

  async audits({ params, response }: HttpContext) {
    const rows = await CallForProposalAudit.query()
      .where('call_for_proposal_id', params.id)
      .preload('actor')
      .orderBy('id', 'desc')
    return response.ok({
      success: true,
      data: rows.map((a) => ({
        id: Number(a.id),
        action: a.action,
        note: a.note,
        actorUserId: Number(a.actorUserId),
        actorName: a.actor?.fullName ?? null,
        createdAt: a.createdAt?.toISO() ?? null,
        diffJson: a.diffJson,
      })),
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(createCfpValidator)
    try {
      const cfp = await CallForProposalService.create(user.id, {
        title: payload.title,
        periodKind: payload.periodKind,
        periodLabel: payload.periodLabel,
        deadlineAt: payload.deadlineAt,
        levels: payload.levels as ProjectProposalLevel[],
        contentHtml: payload.contentHtml,
        attachmentUrls: payload.attachmentUrls,
      })
      return response.created({
        success: true,
        data: CallForProposalService.serialize(cfp),
      })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    const payload = await request.validateUsing(updateCfpValidator)
    try {
      const updated = await CallForProposalService.update(cfp, user.id, {
        title: payload.title,
        periodKind: payload.periodKind,
        periodLabel: payload.periodLabel,
        deadlineAt: payload.deadlineAt,
        levels: payload.levels as ProjectProposalLevel[] | undefined,
        contentHtml: payload.contentHtml,
        attachmentUrls: payload.attachmentUrls,
      })
      return response.ok({ success: true, data: CallForProposalService.serialize(updated) })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  async submit({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    try {
      const updated = await CallForProposalService.submit(cfp, user.id)
      return response.ok({ success: true, data: CallForProposalService.serialize(updated) })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  async approve({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    try {
      const updated = await CallForProposalService.approve(cfp, user.id)
      return response.ok({ success: true, data: CallForProposalService.serialize(updated) })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  async return({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    const payload = await request.validateUsing(returnCfpValidator)
    try {
      const updated = await CallForProposalService.returnToPkh(cfp, user.id, payload.reason)
      return response.ok({ success: true, data: CallForProposalService.serialize(updated) })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  async publish({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    const payload = await request.validateUsing(publishCfpValidator)
    try {
      const updated = await CallForProposalService.publish(cfp, user.id, {
        officialDocNo: payload.officialDocNo,
        officialDocDate: payload.officialDocDate,
        signedFileUrl: payload.signedFileUrl,
      })
      await updated.load('submissionPeriod')
      return response.ok({
        success: true,
        message: 'Đã phát hành. Đang gửi thông báo đến cán bộ.',
        data: CallForProposalService.serialize(updated, { includePeriod: true }),
      })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  async extend({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    const payload = await request.validateUsing(extendCfpValidator)
    try {
      const updated = await CallForProposalService.extend(cfp, user.id, payload.deadlineAt)
      await updated.load('submissionPeriod')
      return response.ok({
        success: true,
        data: CallForProposalService.serialize(updated, { includePeriod: true }),
      })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  async close({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    try {
      const updated = await CallForProposalService.close(cfp, user.id)
      await updated.load('submissionPeriod')
      return response.ok({
        success: true,
        data: CallForProposalService.serialize(updated, { includePeriod: true }),
      })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }
}
