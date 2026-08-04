import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ProposalSelectionSession from '#models/proposal_selection_session'
import ProposalSelectionSessionItem from '#models/proposal_selection_session_item'
import ProjectProposal from '#models/project_proposal'
import PermissionService from '#services/permission_service'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ScientificProfileAdminService from '#services/scientific_profile_admin_service'
import { generateSelectionMinutesHtml } from '#utils/selection_minutes'
import {
  upsertSessionResultsValidator,
  updateSessionMetaValidator,
  bghRejectSessionValidator,
  adminUnlockEditValidator,
} from '#validators/proposal_selection_session_validator'
import { createSelectionSessionValidator } from '#validators/project_proposal_validator'
import { hasAtLeastBusinessDays } from '#utils/business_days'
import User from '#models/user'
import ProposalAdjustmentService from '#services/proposal_adjustment_service'

const RESULT_TO_STATUS: Record<string, 'DUOC_CHON' | 'DIEU_CHINH' | 'KHONG_CHON'> = {
  DONG_Y: 'DUOC_CHON',
  DONG_Y_DIEU_CHINH: 'DIEU_CHINH',
  KHONG_DONG_Y: 'KHONG_CHON',
}

/**
 * US-03-04 — Phiên xét chọn đề tài: nhập kết quả HĐ, biên bản, trình BGH, khóa.
 */
export default class ProposalSelectionSessionsController {
  private serializeSession(s: ProposalSelectionSession, items?: ProposalSelectionSessionItem[]) {
    return {
      id: s.id,
      title: s.title || `Phiên xét chọn #${s.id}`,
      callForProposalId: s.callForProposalId,
      meetingAt: s.meetingAt.toISO(),
      location: s.location,
      status: s.status,
      forceConfirmed: s.forceConfirmed,
      councilMembers: s.councilMembers ?? [],
      minutesFileUrl: s.minutesFileUrl,
      submittedAt: s.submittedAt?.toISO() ?? null,
      bghReviewedAt: s.bghReviewedAt?.toISO() ?? null,
      bghComment: s.bghComment,
      lockedAt: s.lockedAt?.toISO() ?? null,
      version: s.version,
      createdBy: s.createdBy,
      createdAt: s.createdAt.toISO(),
      itemCount: items?.length,
      items: items?.map((it) => this.serializeItem(it)),
    }
  }

  private serializeItem(it: ProposalSelectionSessionItem) {
    const p = it.projectProposal
    return {
      id: it.id,
      projectProposalId: it.projectProposalId,
      councilOpinion: it.councilOpinion,
      councilResult: it.councilResult,
      adjustmentNote: it.adjustmentNote,
      resultEnteredAt: it.resultEnteredAt?.toISO() ?? null,
      proposal: p
        ? {
            id: p.id,
            code: p.code,
            title: p.title,
            ownerName: p.ownerName,
            ownerUnit: p.ownerUnit,
            status: p.status,
            requestedBudgetTotal: p.requestedBudgetTotal,
          }
        : null,
    }
  }

  private async assertPkh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  private async assertBgh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_approve'))
    )
  }

  private validateItemRow(row: {
    councilResult: string
    adjustmentNote?: string | null
    councilOpinion: string
  }) {
    if (!row.councilOpinion?.trim()) return 'Ý kiến Hội đồng bắt buộc.'
    if (row.councilResult === 'DONG_Y_DIEU_CHINH' && !row.adjustmentNote?.trim()) {
      return 'Kết quả “Đồng ý có điều chỉnh” bắt buộc nhập nội dung điều chỉnh.'
    }
    return null
  }

  /** GET /api/proposal-selection-sessions */
  async index({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const canView =
      (await this.assertPkh(user.id)) ||
      (await this.assertBgh(user.id)) ||
      (await ScientificProfileAdminService.userHasAdminKeKhaiRole(user.id))
    if (!canView) {
      return response.forbidden({ success: false, message: 'Không có quyền xem phiên xét chọn.' })
    }
    const rows = await ProposalSelectionSession.query().orderBy('meeting_at', 'desc')
    const data = []
    for (const s of rows) {
      const cnt = await ProposalSelectionSessionItem.query()
        .where('session_id', s.id)
        .count('* as total')
      data.push({
        ...this.serializeSession(s),
        itemCount: Number(cnt[0].$extras.total || 0),
      })
    }
    return response.ok({ success: true, data })
  }

  /** GET /api/proposal-selection-sessions/:id */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canView =
      (await this.assertPkh(user.id)) ||
      (await this.assertBgh(user.id)) ||
      (await ScientificProfileAdminService.userHasAdminKeKhaiRole(user.id))
    if (!canView) {
      return response.forbidden({ success: false, message: 'Không có quyền xem phiên xét chọn.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    }
    const items = await ProposalSelectionSessionItem.query()
      .where('session_id', session.id)
      .preload('projectProposal')
      .orderBy('id', 'asc')
    return response.ok({ success: true, data: this.serializeSession(session, items) })
  }

  /** POST /api/proposal-selection-sessions — tạo phiên (US-03-03) */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH tạo phiên xét chọn.' })
    }
    const payload = await request.validateUsing(createSelectionSessionValidator)
    const meetingAt = DateTime.fromISO(payload.meetingAt)
    if (!meetingAt.isValid) {
      return response.unprocessableEntity({ success: false, message: 'Ngày họp không hợp lệ.' })
    }
    const okDays = hasAtLeastBusinessDays(meetingAt, 5)
    if (!okDays && !payload.forceConfirm) {
      return response.unprocessableEntity({
        success: false,
        code: 'LESS_THAN_5_BUSINESS_DAYS',
        message:
          'Thư mời HĐ phải gửi trước ngày họp ít nhất 5 ngày làm việc. Xác nhận ngoại lệ (forceConfirm) nếu vẫn muốn tạo.',
        warning: true,
      })
    }

    const hopLe = await ProjectProposal.query()
      .where('call_for_proposal_id', payload.callForProposalId)
      .where('status', 'HOP_LE')
    if (!hopLe.length) {
      return response.unprocessableEntity({
        success: false,
        message: 'Chưa có hồ sơ HOP_LE trong kỳ để đưa vào phiên xét chọn.',
      })
    }

    const session = await ProposalSelectionSession.create({
      callForProposalId: payload.callForProposalId,
      title: `Phiên xét chọn kỳ #${payload.callForProposalId}`,
      meetingAt,
      location: payload.location,
      createdBy: user.id,
      forceConfirmed: !okDays && !!payload.forceConfirm,
      status: 'CREATED',
      councilMembers: [],
      version: 1,
    })

    for (const p of hopLe) {
      await ProposalSelectionSessionItem.create({
        sessionId: session.id,
        projectProposalId: p.id,
      })
    }

    await NotificationService.notifySelectionSessionCreated(
      session.id,
      `Họp ${meetingAt.toFormat('dd/MM/yyyy HH:mm')} tại ${payload.location} (${hopLe.length} hồ sơ).`
    )

    return response.created({
      success: true,
      data: {
        id: session.id,
        callForProposalId: session.callForProposalId,
        meetingAt: session.meetingAt.toISO(),
        location: session.location,
        forceConfirmed: session.forceConfirmed,
        itemCount: hopLe.length,
        warningLessThan5BusinessDays: !okDays,
      },
    })
  }

  /** PUT /api/proposal-selection-sessions/:id — meta (title, council members) */
  async updateMeta({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH cập nhật phiên.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status === 'LOCKED') {
      return response.badRequest({ success: false, message: 'Phiên đã khóa.' })
    }
    const payload = await request.validateUsing(updateSessionMetaValidator)
    if (payload.title !== undefined) session.title = payload.title
    if (payload.councilMembers !== undefined) session.councilMembers = payload.councilMembers
    if (session.status === 'CREATED') session.status = 'OPEN'
    await session.save()
    return response.ok({ success: true, data: this.serializeSession(session) })
  }

  /** PUT /api/proposal-selection-sessions/:id/results — lưu nháp kết quả */
  async upsertResults({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH nhập kết quả.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status === 'LOCKED' || session.status === 'PENDING_BGH') {
      return response.badRequest({
        success: false,
        message: 'Không sửa kết quả khi đang chờ BGH hoặc đã khóa.',
      })
    }
    const payload = await request.validateUsing(upsertSessionResultsValidator)
    if (
      payload.expectedVersion != null &&
      Number(payload.expectedVersion) !== Number(session.version)
    ) {
      return response.conflict({
        success: false,
        code: 'VERSION_CONFLICT',
        message: 'Phiên đã được người khác cập nhật. Tải lại rồi lưu lại.',
      })
    }

    for (const row of payload.items) {
      const err = this.validateItemRow(row)
      if (err) {
        return response.unprocessableEntity({
          success: false,
          message: err,
          projectProposalId: row.projectProposalId,
        })
      }
      const item = await ProposalSelectionSessionItem.query()
        .where('session_id', session.id)
        .where('project_proposal_id', row.projectProposalId)
        .first()
      if (!item) {
        return response.badRequest({
          success: false,
          message: `Đề xuất ${row.projectProposalId} không thuộc phiên.`,
        })
      }
      const proposal = await ProjectProposal.find(row.projectProposalId)
      if (!proposal || proposal.status !== 'HOP_LE') {
        return response.unprocessableEntity({
          success: false,
          message: `Đề xuất ${proposal?.code || row.projectProposalId} không còn trạng thái HOP_LE.`,
        })
      }
      item.councilOpinion = row.councilOpinion
      item.councilResult = row.councilResult
      item.adjustmentNote =
        row.councilResult === 'DONG_Y_DIEU_CHINH' ? row.adjustmentNote?.trim() || null : null
      item.resultEnteredBy = user.id
      item.resultEnteredAt = DateTime.now()
      await item.save()
    }

    if (session.status === 'CREATED') session.status = 'OPEN'
    session.version = (session.version || 1) + 1
    await session.save()

    const items = await ProposalSelectionSessionItem.query()
      .where('session_id', session.id)
      .preload('projectProposal')
    return response.ok({ success: true, data: this.serializeSession(session, items) })
  }

  /** POST /api/proposal-selection-sessions/:id/save-minutes */
  async saveMinutes({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH lưu biên bản.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status === 'LOCKED') {
      return response.badRequest({ success: false, message: 'Phiên đã khóa.' })
    }

    const items = await ProposalSelectionSessionItem.query()
      .where('session_id', session.id)
      .preload('projectProposal')
    if (!items.length) {
      return response.unprocessableEntity({ success: false, message: 'Phiên chưa có đề xuất.' })
    }
    for (const it of items) {
      if (!it.councilResult || !it.councilOpinion?.trim()) {
        return response.unprocessableEntity({
          success: false,
          message: `Chưa nhập đủ kết quả cho đề xuất ${it.projectProposal?.code || it.projectProposalId}.`,
        })
      }
      if (it.councilResult === 'DONG_Y_DIEU_CHINH' && !it.adjustmentNote?.trim()) {
        return response.unprocessableEntity({
          success: false,
          message: `Thiếu nội dung điều chỉnh cho ${it.projectProposal?.code}.`,
        })
      }
      if (it.projectProposal?.status !== 'HOP_LE') {
        return response.unprocessableEntity({
          success: false,
          message: `Đề xuất ${it.projectProposal?.code} không còn HOP_LE.`,
        })
      }
    }

    try {
      const { html, relativeUrl } = await generateSelectionMinutesHtml(session, items as any)
      session.minutesHtml = html
      session.minutesFileUrl = relativeUrl
      session.status = 'MINUTES_SAVED'
      session.version = (session.version || 1) + 1
      await session.save()
    } catch (e: any) {
      return response.internalServerError({
        success: false,
        message: e?.message || 'Sinh biên bản thất bại.',
      })
    }

    return response.ok({
      success: true,
      data: this.serializeSession(session, items),
      message: 'Đã lưu biên bản (HTML UTF-8). Có thể in/xuất PDF từ trình duyệt.',
    })
  }

  /** POST /api/proposal-selection-sessions/:id/submit-bgh */
  async submitBgh({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH trình BGH.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'MINUTES_SAVED' && session.status !== 'RETURNED') {
      return response.badRequest({
        success: false,
        message: 'Cần lưu biên bản trước khi trình BGH.',
      })
    }
    if (!session.minutesFileUrl) {
      return response.badRequest({ success: false, message: 'Chưa có file biên bản.' })
    }

    const items = await ProposalSelectionSessionItem.query().where('session_id', session.id)
    if (items.some((it) => !it.councilResult)) {
      return response.unprocessableEntity({
        success: false,
        message: 'Còn đề xuất chưa có kết quả.',
      })
    }

    session.status = 'PENDING_BGH'
    session.submittedAt = DateTime.now()
    session.submittedBy = user.id
    session.bghComment = null
    await session.save()

    await NotificationService.notifyBghSelectionPending(
      session.id,
      session.title || `Phiên #${session.id}`
    )

    return response.ok({ success: true, data: this.serializeSession(session) })
  }

  /** POST /api/proposal-selection-sessions/:id/bgh-approve */
  async bghApprove({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertBgh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ BGH phê duyệt danh mục.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'PENDING_BGH') {
      return response.badRequest({
        success: false,
        message: 'Danh mục không ở trạng thái chờ BGH.',
      })
    }
    // EC-01: tránh double approve
    if (session.lockedAt) {
      return response.ok({ success: true, data: this.serializeSession(session), message: 'Đã khóa.' })
    }

    const items = await ProposalSelectionSessionItem.query()
      .where('session_id', session.id)
      .preload('projectProposal')

    for (const it of items) {
      const nextStatus = RESULT_TO_STATUS[it.councilResult || '']
      if (!nextStatus || !it.projectProposal) continue
      if (it.projectProposal.status !== 'HOP_LE') continue
      const from = it.projectProposal.status
      it.projectProposal.status = nextStatus
      it.projectProposal.canWriteOutline = nextStatus === 'DUOC_CHON'
      it.projectProposal.councilAdjustmentNote =
        nextStatus === 'DIEU_CHINH' ? it.adjustmentNote : null
      await it.projectProposal.save()

      if (nextStatus === 'DIEU_CHINH') {
        await ProposalAdjustmentService.openForProposal(it.projectProposal, user.id)
      }

      await NotificationService.notifyProjectProposalStatusChanged(
        it.projectProposal.ownerId,
        it.projectProposal.code,
        nextStatus,
        it.projectProposal.id
      )
      const dueLabel =
        nextStatus === 'DIEU_CHINH' && it.projectProposal.adjustmentDueAt
          ? it.projectProposal.adjustmentDueAt.toFormat('dd/MM/yyyy HH:mm')
          : null
      await EmailLogService.logStubToUser(
        it.projectProposal.ownerId,
        `[KH&CN] Kết quả xét chọn đề xuất ${it.projectProposal.code}`,
        this.buildResultEmailBody(
          it.projectProposal.title,
          nextStatus,
          it.adjustmentNote,
          dueLabel
        ),
        'project_proposal',
        it.projectProposal.id
      )
    }

    session.status = 'LOCKED'
    session.lockedAt = DateTime.now()
    session.bghReviewedAt = DateTime.now()
    session.bghReviewedBy = user.id
    await session.save()

    return response.ok({
      success: true,
      data: this.serializeSession(session, items),
      message: 'Đã phê duyệt, cập nhật trạng thái đề xuất và khóa phiên.',
    })
  }

  private buildResultEmailBody(
    title: string,
    status: string,
    adjustmentNote: string | null,
    dueLabel?: string | null
  ): string {
    if (status === 'DUOC_CHON') {
      return `Đề xuất "${title}" đã được tuyển chọn. Bạn có thể thực hiện bước Soạn thuyết minh trên hệ thống.`
    }
    if (status === 'DIEU_CHINH') {
      return `Đề xuất "${title}" được đồng ý có điều chỉnh.\n\nNội dung cần điều chỉnh:\n${adjustmentNote || '—'}\n\nHạn nộp lại: ${dueLabel || '5 ngày làm việc kể từ thông báo'}.\nVui lòng chỉnh sửa Tên đề tài và/hoặc Mục tiêu, kèm ghi chú giải trình (≥50 ký tự) trên hệ thống.`
    }
    return `Đề xuất "${title}" không được tuyển chọn trong kỳ này.`
  }

  /** POST /api/proposal-selection-sessions/:id/bgh-reject */
  async bghReject({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertBgh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ BGH từ chối danh mục.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'PENDING_BGH') {
      return response.badRequest({ success: false, message: 'Danh mục không chờ BGH.' })
    }
    const payload = await request.validateUsing(bghRejectSessionValidator)
    session.status = 'RETURNED'
    session.bghComment = payload.reason
    session.bghReviewedAt = DateTime.now()
    session.bghReviewedBy = user.id
    await session.save()

    if (session.submittedBy) {
      await NotificationService.push(session.submittedBy, {
        type: 'PROJECT_UPDATE',
        title: 'BGH yêu cầu chỉnh sửa danh mục xét chọn',
        message: payload.reason,
        link: `/projects/selection-sessions/${session.id}`,
      })
    }
    return response.ok({ success: true, data: this.serializeSession(session) })
  }

  /** GET /api/proposal-selection-sessions/:id/summary — tổng kết theo đơn vị */
  async summary({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canView =
      (await this.assertPkh(user.id)) ||
      (await this.assertBgh(user.id)) ||
      (await ScientificProfileAdminService.userHasAdminKeKhaiRole(user.id))
    if (!canView) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })

    const items = await ProposalSelectionSessionItem.query()
      .where('session_id', session.id)
      .preload('projectProposal')

    const byUnit: Record<
      string,
      { unit: string; dongY: number; dieuChinh: number; khongDongY: number; total: number }
    > = {}
    let dongY = 0
    let dieuChinh = 0
    let khongDongY = 0
    for (const it of items) {
      const unit = it.projectProposal?.ownerUnit || '—'
      if (!byUnit[unit]) {
        byUnit[unit] = { unit, dongY: 0, dieuChinh: 0, khongDongY: 0, total: 0 }
      }
      byUnit[unit].total++
      if (it.councilResult === 'DONG_Y') {
        byUnit[unit].dongY++
        dongY++
      } else if (it.councilResult === 'DONG_Y_DIEU_CHINH') {
        byUnit[unit].dieuChinh++
        dieuChinh++
      } else if (it.councilResult === 'KHONG_DONG_Y') {
        byUnit[unit].khongDongY++
        khongDongY++
      }
    }

    return response.ok({
      success: true,
      data: {
        totals: { dongY, dieuChinh, khongDongY, total: items.length },
        byUnit: Object.values(byUnit),
      },
    })
  }

  /** PUT admin sửa sau khóa */
  async adminEditLocked({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await ScientificProfileAdminService.userHasAdminKeKhaiRole(user.id))) {
      return response.forbidden({
        success: false,
        message: 'Chỉ ADMIN được sửa kết quả sau khi khóa.',
      })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'LOCKED') {
      return response.badRequest({ success: false, message: 'Chỉ áp dụng khi phiên đã khóa.' })
    }
    const payload = await request.validateUsing(adminUnlockEditValidator)

    for (const row of payload.items) {
      const err = this.validateItemRow(row)
      if (err) {
        return response.unprocessableEntity({ success: false, message: err })
      }
      const item = await ProposalSelectionSessionItem.query()
        .where('session_id', session.id)
        .where('project_proposal_id', row.projectProposalId)
        .first()
      if (!item) continue
      const before = {
        councilOpinion: item.councilOpinion,
        councilResult: item.councilResult,
        adjustmentNote: item.adjustmentNote,
      }
      item.councilOpinion = row.councilOpinion
      item.councilResult = row.councilResult
      item.adjustmentNote =
        row.councilResult === 'DONG_Y_DIEU_CHINH' ? row.adjustmentNote?.trim() || null : null
      item.resultEnteredBy = user.id
      item.resultEnteredAt = DateTime.now()
      await item.save()

      const proposal = await ProjectProposal.find(row.projectProposalId)
      if (proposal) {
        const nextStatus = RESULT_TO_STATUS[row.councilResult]
        if (nextStatus) {
          proposal.status = nextStatus
          proposal.canWriteOutline = nextStatus === 'DUOC_CHON'
          proposal.councilAdjustmentNote =
            nextStatus === 'DIEU_CHINH' ? item.adjustmentNote : null
          await proposal.save()
          if (nextStatus === 'DIEU_CHINH') {
            await ProposalAdjustmentService.openForProposal(proposal, user.id)
          }
        }
      }

      await EmailLogService.logStub({
        toEmail: user.email || 'admin@local',
        subject: `[AUDIT] ADMIN sửa kết quả phiên #${session.id}`,
        body: `Lý do: ${payload.reason}\nTrước: ${JSON.stringify(before)}\nSau: ${JSON.stringify(row)}`,
        relatedType: 'proposal_selection_session',
        relatedId: session.id,
      })
    }

    session.version = (session.version || 1) + 1
    await session.save()
    const items = await ProposalSelectionSessionItem.query()
      .where('session_id', session.id)
      .preload('projectProposal')
    return response.ok({ success: true, data: this.serializeSession(session, items) })
  }
}
