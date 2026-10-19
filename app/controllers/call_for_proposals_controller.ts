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
  cfpProposalIdsValidator,
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
    INVALID_PROCESS_TYPES: 'Cấp ý tưởng/đề tài không hợp lệ hoặc đã ngừng hoạt động.',
    MISSING_LEVELS: 'Chọn ít nhất một loại / cấp đề tài từ danh mục.',
    NO_DEFAULT_TEMPLATE: 'Chưa có mẫu thông báo mặc định. Vào Admin → Mẫu biểu mẫu DOCX, tab Thông báo.',
    TEMPLATE_FILE_MISSING: 'Không tìm thấy file mẫu thông báo trên máy chủ.',
    TEMPLATE_RENDER_FAILED: 'Không đổ được dữ liệu vào mẫu thông báo.',
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
    const data = await Promise.all(rows.map((r) => CallForProposalService.serialize(r)))
    return response.ok({ success: true, data })
  }

  async published({ response }: HttpContext) {
    const rows = await CallForProposal.query()
      .where('status', 'PUBLISHED')
      .preload('submissionPeriod')
      .orderBy('published_at', 'desc')
    const data = await Promise.all(
      rows.map((r) => CallForProposalService.serialize(r, { includePeriod: true }))
    )
    return response.ok({ success: true, data })
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
      data: await CallForProposalService.serialize(cfp, { includePeriod: true }),
    })
  }

  async activePeriod({ request, response }: HttpContext) {
    const level = String(request.input('level', '')).trim() as ProjectProposalLevel
    const allowed = ['CO_SO', 'TRUONG', 'BO', 'NHA_NUOC']
    if (!allowed.includes(level)) {
      return response.badRequest({ success: false, message: 'level không hợp lệ.' })
    }
    const processTypeIdRaw = request.input('projectProcessTypeId') ?? request.input('project_process_type_id')
    const processTypeId = processTypeIdRaw != null ? Number(processTypeIdRaw) : null
    const found = await CallForProposalService.findActivePeriodForLevel(
      level,
      Number.isFinite(processTypeId) && processTypeId! > 0 ? processTypeId : null
    )
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
        projectProcessTypeIds: found.callForProposal.projectProcessTypeIds ?? [],
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
    const data = await CallForProposalService.serialize(cfp, {
      includePeriod: true,
      includeAudits: true,
    })
    data.soVanBan = await CallForProposalService.soVanBanHienThi(cfp)
    return response.ok({
      success: true,
      data,
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
        projectProcessTypeIds: payload.projectProcessTypeIds,
        levels: payload.levels as ProjectProposalLevel[] | undefined,
        contentHtml: payload.contentHtml,
        attachmentUrls: payload.attachmentUrls,
      })
      return response.created({
        success: true,
        data: await CallForProposalService.serialize(cfp),
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
        projectProcessTypeIds: payload.projectProcessTypeIds,
        levels: payload.levels as ProjectProposalLevel[] | undefined,
        contentHtml: payload.contentHtml,
        attachmentUrls: payload.attachmentUrls,
      })
      return response.ok({
        success: true,
        data: await CallForProposalService.serialize(updated),
      })
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
      return response.ok({
        success: true,
        data: await CallForProposalService.serialize(updated),
      })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  async headApprove({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    try {
      const updated = await CallForProposalService.headApprove(cfp, user.id)
      return response.ok({
        success: true,
        data: await CallForProposalService.serialize(updated),
      })
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
      return response.ok({
        success: true,
        data: await CallForProposalService.serialize(updated),
      })
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
      return response.ok({
        success: true,
        data: await CallForProposalService.serialize(updated),
      })
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
        data: await CallForProposalService.serialize(updated, { includePeriod: true }),
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
        data: await CallForProposalService.serialize(updated, { includePeriod: true }),
      })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  /** GET /api/call-for-proposals/:id/proposals — nhiệm vụ đã gắn */
  async proposals({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    const canManage = await CallForProposalService.userCanManageList(user.id)
    if (!canManage && cfp.status !== 'PUBLISHED') {
      return response.forbidden({ success: false, message: 'Bạn không có quyền xem thông báo này.' })
    }
    const data = await CallForProposalService.danhSachNhiemVu(cfp)
    return response.ok({ success: true, data })
  }

  /** GET /api/call-for-proposals/proposal-candidates — chọn nhiệm vụ khi đang tạo thông báo */
  async proposalCandidatesByTypes({ request, response }: HttpContext) {
    const raw = request.input('projectProcessTypeIds', '')
    const ids = (Array.isArray(raw) ? raw : String(raw).split(','))
      .map((n) => Number(String(n).trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const perPage = Math.min(50, Math.max(1, Number(request.input('perPage', 10)) || 10))
    const keyword = String(request.input('keyword', '') || '')
    const result = await CallForProposalService.ungVienTheoLoaiQuyTrinh(ids, {
      page,
      perPage,
      keyword,
    })
    return response.ok({ success: true, data: result.data, meta: result.meta })
  }

  /** GET /api/call-for-proposals/:id/proposal-candidates — chọn từ danh mục đề xuất */
  async proposalCandidates({ params, request, response }: HttpContext) {
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const perPage = Math.min(50, Math.max(1, Number(request.input('perPage', 10)) || 10))
    const keyword = String(request.input('keyword', '') || '')
    const result = await CallForProposalService.ungVienNhiemVu(cfp, { page, perPage, keyword })
    return response.ok({ success: true, data: result.data, meta: result.meta })
  }

  /** GET /api/call-for-proposals/:id/notice-view — dữ liệu trang xem HTML */
  async noticeView({ params, response }: HttpContext) {
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    const data = await CallForProposalService.duLieuXemThongBao(cfp)
    return response.ok({ success: true, data })
  }

  /** GET /api/call-for-proposals/:id/notice-preview */
  async noticePreview({ params, response }: HttpContext) {
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    try {
      const text = await CallForProposalService.xemTruocThongBao(cfp)
      return response.ok({ success: true, data: { text } })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  /** GET /api/call-for-proposals/:id/notice-file */
  async noticeFile({ params, response }: HttpContext) {
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    try {
      const { buffer, fileName } = await CallForProposalService.renderMauThongBao(cfp)
      response.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)
      return response.send(buffer)
    } catch (e) {
      return mapServiceError(response, e)
    }
  }

  /** POST /api/call-for-proposals/:id/proposals — gắn nhiệm vụ */
  async attachProposals({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    const payload = await request.validateUsing(cfpProposalIdsValidator)
    const result = await CallForProposalService.ganNhiemVu(cfp, user.id, payload.proposalIds)
    if (!result.ok) {
      return response.unprocessableEntity({ success: false, message: result.message })
    }
    return response.ok({ success: true, data: result })
  }

  /** POST /api/call-for-proposals/:id/proposals/detach — gỡ nhiệm vụ */
  async detachProposals({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const cfp = await CallForProposal.find(params.id)
    if (!cfp) {
      return response.notFound({ success: false, message: 'Không tìm thấy thông báo.' })
    }
    const payload = await request.validateUsing(cfpProposalIdsValidator)
    const result = await CallForProposalService.goNhiemVu(cfp, user.id, payload.proposalIds)
    if (!result.ok) {
      return response.unprocessableEntity({ success: false, message: result.message })
    }
    return response.ok({ success: true, data: result })
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
        data: await CallForProposalService.serialize(updated, { includePeriod: true }),
      })
    } catch (e) {
      return mapServiceError(response, e)
    }
  }
}
