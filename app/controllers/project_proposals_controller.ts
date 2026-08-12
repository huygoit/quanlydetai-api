import type { HttpContext } from '@adonisjs/core/http'
import ProjectProposal from '#models/project_proposal'
import ProjectProposalAudit from '#models/project_proposal_audit'
import ProjectProcessType from '#models/project_process_type'
import AuditLogService from '#services/audit_log_service'
import NotificationService from '#services/notification_service'
import PermissionService from '#services/permission_service'
import CallForProposalService from '#services/call_for_proposal_service'
import {
  createProjectProposalValidator,
  updateProjectProposalValidator,
  unitReviewProposalValidator,
  unitReturnProposalValidator,
  requestSupplementValidator,
  extendSupplementValidator,
  rejectByPkhValidator,
  createSelectionSessionValidator,
  submitCouncilAdjustmentValidator,
  extendAdjustmentValidator,
} from '#validators/project_proposal_validator'
import type { ProjectProposalLevel, ProjectProposalStatus } from '#models/project_proposal'
import EmailLogService from '#services/email_log_service'
import { DateTime } from 'luxon'
import * as XLSX from 'xlsx'
import { addBusinessDays, hasAtLeastBusinessDays } from '#utils/business_days'
import ProposalSelectionSession from '#models/proposal_selection_session'
import ProposalSelectionSessionItem from '#models/proposal_selection_session_item'
import ProjectProposalAdjustmentVersion from '#models/project_proposal_adjustment_version'
import ProposalAdjustmentService from '#services/proposal_adjustment_service'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { resolveUserUnitLabel, sameDepartmentId } from '#utils/user_unit'
import { isActiveFieldName } from '#utils/catalog_assert'

/**
 * Ánh xạ mã QT → cấp dùng kiểm tra kỳ CFP.
 * QT-I Trường, QT-II Bộ, QT-III Tỉnh/DN, QT-IV Quỹ, QT-V HĐ dịch vụ.
 */
const QT_CODE_TO_LEVEL: Record<string, ProjectProposalLevel> = {
  'QT-I': 'TRUONG',
  'QT-II': 'BO',
  'QT-III': 'CO_SO',
  'QT-IV': 'NHA_NUOC',
  'QT-V': 'CO_SO',
}

/**
 * API Đăng ký / nộp đề xuất đề tài.
 * US-03-02: DRAFT → SUBMITTED → RETURNED | CHO_PKH
 * US-03-03: CHO_PKH → HOP_LE | YEU_CAU_BS | DA_LOAI
 */
export default class ProjectProposalsController {
  private serialize(p: ProjectProposal) {
    const rot = p.researchOutputType
    const ppt = p.projectProcessType
    return {
      id: p.id,
      code: p.code,
      title: p.title,
      field: p.field,
      level: p.level,
      year: p.year,
      durationMonths: p.durationMonths,
      keywords: p.keywords ?? [],
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt.toISO(),
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      ownerEmail: p.ownerEmail,
      ownerUnit: p.ownerUnit,
      coAuthors: p.coAuthors ?? [],
      objectives: p.objectives,
      summary: p.summary,
      contentOutline: p.contentOutline,
      expectedResults: p.expectedResults,
      applicationPotential: p.applicationPotential,
      requestedBudgetTotal: p.requestedBudgetTotal,
      requestedBudgetDetail: p.requestedBudgetDetail,
      status: p.status,
      unitComment: p.unitComment,
      unitApproved: p.unitApproved,
      sciDeptComment: p.sciDeptComment,
      sciDeptPriority: p.sciDeptPriority,
      researchOutputTypeId: p.researchOutputTypeId,
      researchOutputType: rot ? { id: rot.id, code: rot.code, name: rot.name } : null,
      researchDirection: p.researchDirection,
      attachmentUrl: p.attachmentUrl,
      callForProposalId: p.callForProposalId,
      projectProcessTypeId: p.projectProcessTypeId,
      projectProcessType: ppt
        ? { id: ppt.id, code: ppt.code, name: ppt.name }
        : null,
      supplementDueAt: p.supplementDueAt?.toISO() ?? null,
      supplementOverdue: p.supplementOverdue ?? false,
      pkhComment: p.pkhComment,
      canWriteOutline: p.canWriteOutline ?? false,
      councilAdjustmentNote: p.councilAdjustmentNote,
      adjustmentNotifiedAt: p.adjustmentNotifiedAt?.toISO() ?? null,
      adjustmentDueAt: p.adjustmentDueAt?.toISO() ?? null,
      adjustmentOverdue: p.adjustmentOverdue ?? false,
      adjustmentReminderSentAt: p.adjustmentReminderSentAt?.toISO() ?? null,
      adjustmentExplanation: p.adjustmentExplanation,
    }
  }

  private serializeListItem(p: ProjectProposal) {
    const ppt = p.projectProcessType
    return {
      id: p.id,
      code: p.code,
      title: p.title,
      field: p.field,
      level: p.level,
      year: p.year,
      durationMonths: p.durationMonths,
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      ownerUnit: p.ownerUnit,
      status: p.status,
      requestedBudgetTotal: p.requestedBudgetTotal,
      researchOutputTypeId: p.researchOutputTypeId,
      attachmentUrl: p.attachmentUrl,
      callForProposalId: p.callForProposalId,
      projectProcessTypeId: p.projectProcessTypeId,
      projectProcessType: ppt
        ? { id: ppt.id, code: ppt.code, name: ppt.name }
        : null,
      supplementDueAt: p.supplementDueAt?.toISO() ?? null,
      supplementOverdue: p.supplementOverdue ?? false,
      pkhComment: p.pkhComment,
      councilAdjustmentNote: p.councilAdjustmentNote,
      adjustmentDueAt: p.adjustmentDueAt?.toISO() ?? null,
      adjustmentOverdue: p.adjustmentOverdue ?? false,
      canWriteOutline: p.canWriteOutline ?? false,
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt.toISO(),
    }
  }

  /**
   * So khớp chủ hồ sơ: owner_id (bigint PG) và user.id có thể lệch kiểu string/number.
   * Dùng Number() — tránh `!==` khiến owner bị 403 dù đúng người.
   */
  private isProposalOwner(proposal: ProjectProposal, userId: number | string): boolean {
    return Number(proposal.ownerId) === Number(userId)
  }

  /** Resolve loại quy trình ACTIVE → level CFP */
  private async resolveProcessType(id: number) {
    const row = await ProjectProcessType.query()
      .where('id', id)
      .where('status', 'ACTIVE')
      .first()
    if (!row) throw new Error('PROCESS_TYPE_NOT_FOUND')
    const level = QT_CODE_TO_LEVEL[row.code] || ('TRUONG' as ProjectProposalLevel)
    return { processType: row, level }
  }

  /** Ghi timeline trạng thái đề xuất */
  private async writeAudit(
    proposalId: number,
    actorUserId: number,
    action: string,
    fromStatus: string | null,
    toStatus: string | null,
    note?: string | null
  ) {
    await ProjectProposalAudit.create({
      projectProposalId: proposalId,
      actorUserId,
      action,
      fromStatus,
      toStatus,
      note: note ?? null,
    })
  }

  /** Trạng thái cho phép GV sửa */
  private isEditable(status: ProjectProposalStatus) {
    return status === 'DRAFT' || status === 'RETURNED' || status === 'YEU_CAU_BS'
  }

  /** Lazy gắn tag quá hạn bổ sung */
  private async refreshSupplementOverdue(p: ProjectProposal) {
    if (p.status !== 'YEU_CAU_BS' || !p.supplementDueAt) return
    const overdue = DateTime.now() > p.supplementDueAt
    if (overdue !== p.supplementOverdue) {
      p.supplementOverdue = overdue
      await p.save()
    }
  }

  /** Lazy gắn tag quá hạn điều chỉnh HĐ */
  private async refreshAdjustmentOverdue(p: ProjectProposal) {
    // Hồ sơ DIEU_CHINH cũ (trước US-03-05) — mở kỳ hạn khi đọc lần đầu
    if (p.status === 'DIEU_CHINH' && !p.adjustmentDueAt) {
      await ProposalAdjustmentService.openForProposal(p)
      return
    }
    if (ProposalAdjustmentService.refreshOverdue(p)) {
      await p.save()
    }
  }

  private async assertPkh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  private async assertAdjustmentExtend(userId: number) {
    return (
      (await this.assertPkh(userId)) ||
      (await PermissionService.userHasPermission(userId, 'project.adjustment_extend'))
    )
  }

  /** Validate đủ field trước khi gửi Khoa */
  private assertReadyToSubmit(p: ProjectProposal): string | null {
    if (!p.title?.trim()) return 'Thiếu tên đề tài.'
    if (!p.objectives?.trim()) return 'Thiếu mục tiêu tổng quát.'
    if (!p.expectedResults?.trim()) return 'Thiếu sản phẩm dự kiến.'
    if (!p.level) return 'Thiếu phân cấp đề tài.'
    if (!p.projectProcessTypeId) return 'Thiếu loại quy trình / phân cấp đề tài.'
    if (p.requestedBudgetTotal == null || p.requestedBudgetTotal < 0) {
      return 'Thiếu kinh phí dự kiến.'
    }
    if (!p.durationMonths || p.durationMonths < 1) return 'Thiếu thời gian thực hiện.'
    if (!p.attachmentUrl) return 'Thiếu file biểu mẫu đề xuất (PDF hoặc DOCX).'
    return null
  }

  /**
   * GET /api/project-proposals
   */
  async index({ request, response, auth }: HttpContext) {
    const user = auth.use('api').user!
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const keyword = request.input('keyword', '')
    const year = request.input('year', '')
    const status = request.input('status', '') as ProjectProposalStatus | ''
    const level = request.input('level', '')
    const field = request.input('field', '')
    const unit = request.input('unit', '')
    const ownerOnly = request.input('ownerOnly', false)
    const callForProposalId = request.input('callForProposalId', '')

    const q = ProjectProposal.query()
      .preload('projectProcessType')
      .orderBy('updated_at', 'desc')

    if (keyword) {
      q.where((b) => {
        b.whereILike('code', `%${keyword}%`)
          .orWhereILike('title', `%${keyword}%`)
          .orWhereILike('owner_name', `%${keyword}%`)
      })
    }
    if (year) q.where('year', year)
    const statusesRaw = request.input('statuses', '')
    const statusesList = Array.isArray(statusesRaw)
      ? statusesRaw.map((s) => String(s).trim()).filter(Boolean)
      : String(statusesRaw || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
    if (statusesList.length > 0) {
      q.whereIn('status', statusesList)
    } else if (status) {
      q.where('status', status)
    }
    if (level) q.where('level', level)
    if (field) q.where('field', field)
    if (unit) q.whereILike('owner_unit', `%${unit}%`)
    if (callForProposalId) q.where('call_for_proposal_id', callForProposalId)

    if (ownerOnly) {
      q.where('owner_id', user.id)
    } else {
      const hasViewAll = await PermissionService.userHasPermission(user.id, 'project.view')
      const hasPkhReview = await PermissionService.userHasPermission(user.id, 'project.review')
      const hasUnitReview = await PermissionService.userHasPermission(
        user.id,
        'project.assign_reviewer'
      )
      if (hasPkhReview || hasViewAll) {
        // PKH / xem tất cả — không giới hạn đơn vị
      } else if (hasUnitReview && user.departmentId != null) {
        // Trưởng khoa: chỉ đề xuất của GV cùng department_id
        const peerIds = await User.query().where('department_id', user.departmentId).select('id')
        const ids = peerIds.map((u) => u.id)
        if (ids.length) q.whereIn('owner_id', ids)
        else q.where('owner_id', user.id)
      } else {
        q.where('owner_id', user.id)
      }
    }

    const paginated = await q.paginate(page, perPage)
    for (const p of paginated.all()) {
      await this.refreshSupplementOverdue(p)
      await this.refreshAdjustmentOverdue(p)
    }
    const data = paginated.all().map((p) => this.serializeListItem(p))
    return response.ok({
      success: true,
      data,
      meta: {
        total: paginated.total,
        currentPage: paginated.currentPage,
        perPage: paginated.perPage,
        lastPage: paginated.lastPage,
      },
    })
  }

  /** GET /api/project-proposals/:id */
  async show({ params, response }: HttpContext) {
    const proposal = await ProjectProposal.query()
      .where('id', params.id)
      .preload('researchOutputType')
      .preload('projectProcessType')
      .first()
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    await this.refreshAdjustmentOverdue(proposal)
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** GET /api/project-proposals/:id/audits — timeline trạng thái */
  async audits({ params, response }: HttpContext) {
    const rows = await ProjectProposalAudit.query()
      .where('project_proposal_id', params.id)
      .preload('actor')
      .orderBy('id', 'desc')
    return response.ok({
      success: true,
      data: rows.map((a) => ({
        id: Number(a.id),
        action: a.action,
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        note: a.note,
        actorUserId: Number(a.actorUserId),
        actorName: a.actor?.fullName ?? null,
        createdAt: a.createdAt?.toISO() ?? null,
      })),
    })
  }

  /** POST /api/project-proposals */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(createProjectProposalValidator)

    if (!(await isActiveFieldName(payload.field))) {
      return response.badRequest({ success: false, message: 'Lĩnh vực không thuộc danh mục.' })
    }

    let processTypeId = payload.projectProcessTypeId
    let level: ProjectProposalLevel
    try {
      const resolved = await this.resolveProcessType(processTypeId)
      level = payload.level || resolved.level
      processTypeId = resolved.processType.id
    } catch {
      return response.unprocessableEntity({
        success: false,
        message: 'Cấp ý tưởng/đề tài không hợp lệ hoặc đã ngừng hoạt động.',
      })
    }

    // AC1: chỉ tạo khi có kỳ OPEN khớp cấp (suy từ QT)
    const active = await CallForProposalService.findActivePeriodForLevel(level, processTypeId)
    if (!active) {
      return response.unprocessableEntity({
        success: false,
        message:
          'Hiện không có kỳ tiếp nhận hồ sơ đang mở cho cấp đề tài này. Vui lòng chờ Thông báo tuyển chọn được phát hành.',
      })
    }

    const code = await ProjectProposal.generateCode(payload.year)
    const summary = (payload.summary || payload.objectives).trim()
    const ownerUnit = await resolveUserUnitLabel(user)

    const proposal = await ProjectProposal.create({
      code,
      title: payload.title,
      field: payload.field,
      level,
      year: payload.year,
      durationMonths: payload.durationMonths,
      keywords: payload.keywords ?? [],
      ownerId: user.id,
      ownerName: user.fullName,
      ownerEmail: user.email,
      ownerUnit,
      coAuthors: payload.coAuthors ?? [],
      objectives: payload.objectives,
      summary,
      contentOutline: payload.contentOutline ?? null,
      expectedResults: payload.expectedResults ?? null,
      applicationPotential: payload.applicationPotential ?? null,
      requestedBudgetTotal: payload.requestedBudgetTotal ?? null,
      requestedBudgetDetail: payload.requestedBudgetDetail ?? null,
      researchOutputTypeId: payload.researchOutputTypeId ?? null,
      researchDirection: payload.researchDirection ?? null,
      attachmentUrl: payload.attachmentUrl ?? null,
      callForProposalId: active.callForProposal.id,
      projectProcessTypeId: processTypeId,
      status: 'DRAFT',
    })

    await proposal.load('projectProcessType')
    await this.writeAudit(proposal.id, user.id, 'CREATE', null, 'DRAFT')
    return response.created({ success: true, data: this.serialize(proposal) })
  }

  /** PUT /api/project-proposals/:id — DRAFT hoặc RETURNED, chỉ owner */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (!this.isEditable(proposal.status)) {
      return response.badRequest({
        success: false,
        message: 'Chỉ được sửa đề xuất ở trạng thái Nháp, Khoa trả lại hoặc PKH yêu cầu bổ sung.',
      })
    }
    if (!this.isProposalOwner(proposal, user.id)) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền sửa đề xuất này.' })
    }

    const payload = await request.validateUsing(updateProjectProposalValidator)

    if (payload.field !== undefined && !(await isActiveFieldName(payload.field))) {
      return response.badRequest({ success: false, message: 'Lĩnh vực không thuộc danh mục.' })
    }

    // Đổi loại quy trình / cấp → kiểm tra lại kỳ OPEN
    if (payload.projectProcessTypeId != null) {
      try {
        const resolved = await this.resolveProcessType(payload.projectProcessTypeId)
        proposal.projectProcessTypeId = resolved.processType.id
        proposal.level = payload.level || resolved.level
      } catch {
        return response.unprocessableEntity({
          success: false,
          message: 'Cấp ý tưởng/đề tài không hợp lệ hoặc đã ngừng hoạt động.',
        })
      }
      const active = await CallForProposalService.findActivePeriodForLevel(
        proposal.level,
        proposal.projectProcessTypeId
      )
      if (!active) {
        return response.unprocessableEntity({
          success: false,
          message: 'Không có kỳ tiếp nhận đang mở cho cấp đề tài tương ứng.',
        })
      }
      proposal.callForProposalId = active.callForProposal.id
    } else if (payload.level && payload.level !== proposal.level) {
      const active = await CallForProposalService.findActivePeriodForLevel(
        payload.level,
        proposal.projectProcessTypeId
      )
      if (!active) {
        return response.unprocessableEntity({
          success: false,
          message: 'Không có kỳ tiếp nhận đang mở cho cấp đề tài mới.',
        })
      }
      proposal.callForProposalId = active.callForProposal.id
      proposal.level = payload.level
    }

    const { projectProcessTypeId: _ppt, level: _lv, ...rest } = payload
    proposal.merge({
      ...rest,
      summary: payload.summary ?? proposal.summary,
    })
    await proposal.save()
    await proposal.load('projectProcessType')
    await this.writeAudit(proposal.id, user.id, 'UPDATE', proposal.status, proposal.status)
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** DELETE /api/project-proposals/:id */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'DRAFT') {
      return response.badRequest({
        success: false,
        message: 'Chỉ được xóa đề xuất ở trạng thái Nháp.',
      })
    }
    if (!this.isProposalOwner(proposal, user.id)) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền xóa đề xuất này.' })
    }
    await proposal.delete()
    return response.ok({ success: true, message: 'Đã xóa đề xuất.' })
  }

  /** POST /api/project-proposals/:id/submit — DRAFT|RETURNED → SUBMITTED */
  async submit(ctx: HttpContext) {
    const { auth, params, response } = ctx
    const user = auth.use('api').user!
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (!this.isEditable(proposal.status)) {
      return response.badRequest({
        success: false,
        message: 'Chỉ được gửi đề xuất ở trạng thái Nháp hoặc Khoa trả lại.',
      })
    }
    if (!this.isProposalOwner(proposal, user.id)) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền gửi đề xuất này.' })
    }

    const readyErr = this.assertReadyToSubmit(proposal)
    if (readyErr) {
      return response.unprocessableEntity({ success: false, message: readyErr })
    }

    const active = await CallForProposalService.findActivePeriodForLevel(
      proposal.level,
      proposal.projectProcessTypeId
    )
    if (!active) {
      return response.unprocessableEntity({
        success: false,
        message:
          'Kỳ tiếp nhận hồ sơ đã hết hạn hoặc chưa mở. Bạn chỉ được xem hồ sơ, không gửi mới được.',
      })
    }

    const from = proposal.status
    // Backfill đơn vị nếu trống (user IAM chỉ có departmentId)
    if (!String(proposal.ownerUnit ?? '').trim()) {
      const ownerUnit = await resolveUserUnitLabel(user)
      if (ownerUnit) proposal.ownerUnit = ownerUnit
    }
    proposal.status = 'SUBMITTED'
    proposal.callForProposalId = active.callForProposal.id
    proposal.unitApproved = null
    await proposal.save()

    await this.writeAudit(proposal.id, user.id, 'SUBMIT', from, 'SUBMITTED')
    await AuditLogService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'SUBMIT',
      entityType: 'PROJECT_PROPOSAL',
      entityId: String(proposal.id),
      newData: this.serialize(proposal),
      ctx,
    })

    // AC3: thông báo Trưởng Khoa (user có project.assign_reviewer cùng đơn vị)
    await NotificationService.notifyUnitHeadsProposalSubmitted(proposal)

    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /**
   * POST /api/project-proposals/:id/withdraw
   * SUBMITTED → DRAFT (rút về nháp để sửa / gửi lại). Audit vẫn ghi WITHDRAW.
   */
  async withdraw(ctx: HttpContext) {
    const { auth, params, response } = ctx
    const user = auth.use('api').user!
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'SUBMITTED') {
      return response.badRequest({
        success: false,
        message: 'Chỉ được rút đề xuất đang chờ Khoa.',
      })
    }
    if (!this.isProposalOwner(proposal, user.id)) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền rút đề xuất này.' })
    }

    const oldData = this.serialize(proposal)
    const from = proposal.status
    proposal.status = 'DRAFT'
    proposal.unitApproved = null
    proposal.unitComment = null
    await proposal.save()
    await this.writeAudit(proposal.id, user.id, 'WITHDRAW', from, 'DRAFT')

    await AuditLogService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'WITHDRAW',
      entityType: 'PROJECT_PROPOSAL',
      entityId: String(proposal.id),
      oldData,
      newData: this.serialize(proposal),
      ctx,
    })
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /**
   * POST /api/project-proposals/:id/unit-review
   * unitApproved=true  → CHO_PKH
   * unitApproved=false → RETURNED
   */
  async unitReview({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canReview = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
    if (!canReview) {
      return response.forbidden({
        success: false,
        message: 'Chỉ Trưởng đơn vị được xử lý đề xuất.',
      })
    }

    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'SUBMITTED') {
      return response.badRequest({
        success: false,
        message: 'Chỉ xử lý đề xuất đang chờ Khoa.',
      })
    }
    const owner = await User.find(proposal.ownerId)
    if (!sameDepartmentId(user.departmentId, owner?.departmentId)) {
      return response.forbidden({
        success: false,
        message: 'Bạn không có quyền duyệt đề xuất của đơn vị khác.',
      })
    }
    // Chỉ để hiển thị: bổ sung owner_unit nếu trống
    if (!String(proposal.ownerUnit ?? '').trim()) {
      const label = await resolveUserUnitLabel(user)
      if (label) proposal.ownerUnit = label
    }

    const payload = await request.validateUsing(unitReviewProposalValidator)
    const from = proposal.status
    proposal.unitApproved = payload.unitApproved
    proposal.unitComment = payload.unitComment

    if (payload.unitApproved) {
      proposal.status = 'CHO_PKH'
      await proposal.save()
      await this.writeAudit(
        proposal.id,
        user.id,
        'UNIT_CONFIRM',
        from,
        'CHO_PKH',
        payload.unitComment
      )
      await NotificationService.notifyProjectProposalStatusChanged(
        proposal.ownerId,
        proposal.code,
        'CHO_PKH',
        proposal.id
      )
      await NotificationService.notifyPkhProposalReady({
        id: proposal.id,
        code: proposal.code,
        title: proposal.title,
        ownerName: proposal.ownerName,
      })
    } else {
      proposal.status = 'RETURNED'
      await proposal.save()
      await this.writeAudit(
        proposal.id,
        user.id,
        'UNIT_RETURN',
        from,
        'RETURNED',
        payload.unitComment
      )
      await NotificationService.notifyProjectProposalStatusChanged(
        proposal.ownerId,
        proposal.code,
        'RETURNED',
        proposal.id
      )
    }

    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals/:id/unit-return — alias trả lại rõ ràng */
  async unitReturn({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canReview = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
    if (!canReview) {
      return response.forbidden({
        success: false,
        message: 'Chỉ Trưởng đơn vị được trả lại đề xuất.',
      })
    }
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'SUBMITTED') {
      return response.badRequest({
        success: false,
        message: 'Chỉ trả lại đề xuất đang chờ Khoa.',
      })
    }
    const owner = await User.find(proposal.ownerId)
    if (!sameDepartmentId(user.departmentId, owner?.departmentId)) {
      return response.forbidden({
        success: false,
        message: 'Bạn không có quyền trả lại đề xuất của đơn vị khác.',
      })
    }
    if (!String(proposal.ownerUnit ?? '').trim()) {
      const label = await resolveUserUnitLabel(user)
      if (label) proposal.ownerUnit = label
    }

    const payload = await request.validateUsing(unitReturnProposalValidator)
    const from = proposal.status
    proposal.status = 'RETURNED'
    proposal.unitApproved = false
    proposal.unitComment = payload.reason
    await proposal.save()
    await this.writeAudit(proposal.id, user.id, 'UNIT_RETURN', from, 'RETURNED', payload.reason)
    await NotificationService.notifyProjectProposalStatusChanged(
      proposal.ownerId,
      proposal.code,
      'RETURNED',
      proposal.id
    )
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals/:id/mark-valid — CHO_PKH → HOP_LE */
  async markValid({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH được xác nhận hợp lệ.' })
    }
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'CHO_PKH') {
      return response.badRequest({
        success: false,
        message: 'Chỉ xác nhận hợp lệ hồ sơ đang chờ PKH.',
      })
    }
    const from = proposal.status
    proposal.status = 'HOP_LE'
    proposal.supplementOverdue = false
    await proposal.save()
    await this.writeAudit(proposal.id, user.id, 'PKH_MARK_VALID', from, 'HOP_LE')
    await NotificationService.notifyProjectProposalStatusChanged(
      proposal.ownerId,
      proposal.code,
      'HOP_LE',
      proposal.id
    )
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals/:id/request-supplement — CHO_PKH → YEU_CAU_BS */
  async requestSupplement({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH được yêu cầu bổ sung.' })
    }
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'CHO_PKH') {
      return response.badRequest({
        success: false,
        message: 'Chỉ yêu cầu bổ sung hồ sơ đang chờ PKH.',
      })
    }
    const payload = await request.validateUsing(requestSupplementValidator)
    const from = proposal.status
    proposal.status = 'YEU_CAU_BS'
    proposal.pkhComment = payload.note
    proposal.supplementDueAt = DateTime.now().plus({ days: 3 })
    proposal.supplementOverdue = false
    await proposal.save()
    await this.writeAudit(
      proposal.id,
      user.id,
      'PKH_REQUEST_SUPPLEMENT',
      from,
      'YEU_CAU_BS',
      payload.note
    )
    await NotificationService.notifyProjectProposalStatusChanged(
      proposal.ownerId,
      proposal.code,
      'YEU_CAU_BS',
      proposal.id
    )
    await EmailLogService.logStubToUser(
      proposal.ownerId,
      `[KH&CN] Yêu cầu bổ sung đề xuất ${proposal.code}`,
      `Đề xuất "${proposal.title}" (${proposal.code}) cần bổ sung:\n\n${payload.note}\n\nHạn bổ sung: ${proposal.supplementDueAt.toFormat('dd/MM/yyyy HH:mm')}.`,
      'project_proposal',
      proposal.id
    )
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals/:id/resubmit-to-pkh — YEU_CAU_BS → CHO_PKH (GV) */
  async resubmitToPkh({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (!this.isProposalOwner(proposal, user.id)) {
      return response.forbidden({ success: false, message: 'Chỉ chủ hồ sơ được gửi lại PKH.' })
    }
    if (proposal.status !== 'YEU_CAU_BS') {
      return response.badRequest({
        success: false,
        message: 'Chỉ gửi lại khi đang yêu cầu bổ sung.',
      })
    }
    const readyErr = this.assertReadyToSubmit(proposal)
    if (readyErr) {
      return response.unprocessableEntity({ success: false, message: readyErr })
    }
    const from = proposal.status
    proposal.status = 'CHO_PKH'
    proposal.supplementOverdue = false
    await proposal.save()
    await this.writeAudit(proposal.id, user.id, 'RESUBMIT_TO_PKH', from, 'CHO_PKH')
    await NotificationService.notifyPkhProposalReady({
      id: proposal.id,
      code: proposal.code,
      title: proposal.title,
      ownerName: proposal.ownerName,
    })
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals/:id/extend-supplement */
  async extendSupplement({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH được gia hạn bổ sung.' })
    }
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'YEU_CAU_BS') {
      return response.badRequest({
        success: false,
        message: 'Chỉ gia hạn hồ sơ đang yêu cầu bổ sung.',
      })
    }
    const payload = await request.validateUsing(extendSupplementValidator)
    const due = DateTime.fromISO(payload.dueAt)
    if (!due.isValid || due <= DateTime.now()) {
      return response.unprocessableEntity({
        success: false,
        message: 'Hạn bổ sung mới phải là thời điểm trong tương lai.',
      })
    }
    proposal.supplementDueAt = due
    proposal.supplementOverdue = false
    if (payload.reason) proposal.pkhComment = payload.reason
    await proposal.save()
    await this.writeAudit(
      proposal.id,
      user.id,
      'PKH_EXTEND_SUPPLEMENT',
      'YEU_CAU_BS',
      'YEU_CAU_BS',
      payload.reason ?? `Gia hạn đến ${due.toISO()}`
    )
    await NotificationService.notifyProjectProposalStatusChanged(
      proposal.ownerId,
      proposal.code,
      'YEU_CAU_BS_EXTENDED',
      proposal.id
    )
    await EmailLogService.logStubToUser(
      proposal.ownerId,
      `[KH&CN] Gia hạn bổ sung đề xuất ${proposal.code}`,
      `Hạn bổ sung mới: ${due.toFormat('dd/MM/yyyy HH:mm')}.${payload.reason ? `\n\nLý do: ${payload.reason}` : ''}`,
      'project_proposal',
      proposal.id
    )
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals/:id/reject-by-pkh → DA_LOAI */
  async rejectByPkh({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH được loại hồ sơ.' })
    }
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'CHO_PKH' && proposal.status !== 'YEU_CAU_BS') {
      return response.badRequest({
        success: false,
        message: 'Chỉ loại hồ sơ đang chờ PKH hoặc yêu cầu bổ sung.',
      })
    }
    const payload = await request.validateUsing(rejectByPkhValidator)
    const from = proposal.status
    proposal.status = 'DA_LOAI'
    proposal.pkhComment = payload.reason
    proposal.supplementOverdue = false
    await proposal.save()
    await this.writeAudit(proposal.id, user.id, 'PKH_REJECT', from, 'DA_LOAI', payload.reason)
    await NotificationService.notifyProjectProposalStatusChanged(
      proposal.ownerId,
      proposal.code,
      'DA_LOAI',
      proposal.id
    )
    await EmailLogService.logStubToUser(
      proposal.ownerId,
      `[KH&CN] Đề xuất ${proposal.code} đã bị loại`,
      `Đề xuất "${proposal.title}" (${proposal.code}) đã bị PKH loại.\n\nLý do: ${payload.reason}`,
      'project_proposal',
      proposal.id
    )
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** GET /api/project-proposals/pkh/stats?callForProposalId= */
  async pkhStats({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH xem thống kê này.' })
    }
    const cfpId = Number(request.input('callForProposalId'))
    if (!Number.isFinite(cfpId) || cfpId <= 0) {
      return response.badRequest({ success: false, message: 'Thiếu callForProposalId.' })
    }
    const base = ProjectProposal.query().where('call_for_proposal_id', cfpId)
    const countStatus = async (st: string) => {
      const r = await base.clone().where('status', st).count('* as total')
      return Number(r[0].$extras.total || 0)
    }
    // Tổng đã nhận = đã qua Khoa (không tính DRAFT/SUBMITTED/RETURNED/WITHDRAWN thuần GV)
    const pkhStatuses = ['CHO_PKH', 'HOP_LE', 'YEU_CAU_BS', 'DA_LOAI']
    const totalReceived = await (async () => {
      const r = await ProjectProposal.query()
        .where('call_for_proposal_id', cfpId)
        .whereIn('status', pkhStatuses)
        .count('* as total')
      return Number(r[0].$extras.total || 0)
    })()

    // Cập nhật overdue lazy
    const pendingBs = await ProjectProposal.query()
      .where('call_for_proposal_id', cfpId)
      .where('status', 'YEU_CAU_BS')
    for (const p of pendingBs) await this.refreshSupplementOverdue(p)

    return response.ok({
      success: true,
      data: {
        totalReceived,
        hopLe: await countStatus('HOP_LE'),
        choBoSung: await countStatus('YEU_CAU_BS'),
        daLoai: await countStatus('DA_LOAI'),
        choPkh: await countStatus('CHO_PKH'),
      },
    })
  }

  /** GET /api/project-proposals/pkh/export-excel?callForProposalId= — chỉ HOP_LE */
  async exportPkhExcel({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH xuất danh mục.' })
    }
    const cfpId = Number(request.input('callForProposalId'))
    if (!Number.isFinite(cfpId) || cfpId <= 0) {
      return response.badRequest({ success: false, message: 'Thiếu callForProposalId.' })
    }
    const rows = await ProjectProposal.query()
      .where('call_for_proposal_id', cfpId)
      .where('status', 'HOP_LE')
      .preload('projectProcessType')
      .orderBy('id', 'asc')

    const sheetData = [
      ['STT', 'Tên đề tài', 'Giảng viên chủ nhiệm', 'Đơn vị', 'Phân cấp đề tài', 'Kinh phí đề xuất'],
      ...rows.map((p, i) => [
        i + 1,
        p.title,
        p.ownerName,
        p.ownerUnit,
        p.projectProcessType
          ? `${p.projectProcessType.code}: ${p.projectProcessType.name}`
          : p.level,
        p.requestedBudgetTotal ?? '',
      ]),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    XLSX.utils.book_append_sheet(wb, ws, 'Danh muc')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    response.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response.header(
      'Content-Disposition',
      `attachment; filename="danh-muc-hop-le-cfp-${cfpId}.xlsx"`
    )
    return response.send(buf)
  }

  /** POST /api/proposal-selection-sessions — MVP phiên xét chọn */
  async createSelectionSession({ auth, request, response }: HttpContext) {
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
      meetingAt,
      location: payload.location,
      createdBy: user.id,
      forceConfirmed: !okDays && !!payload.forceConfirm,
      status: 'CREATED',
    })

    for (const p of hopLe) {
      await ProposalSelectionSessionItem.create({
        sessionId: session.id,
        projectProposalId: p.id,
      })
    }

    // Stub thư mời + thông báo theo quyền quản lý phiên (không theo role cứng / council.view ý tưởng)
    const inviteIds = await PermissionService.getUserIdsWithAnyPermission([
      'project.selection_manage',
      'project.review',
    ])
    const inviteUsers = inviteIds.length
      ? await User.query().whereIn('id', inviteIds).where('is_active', true)
      : []
    for (const cu of inviteUsers) {
      if (!cu.email) continue
      await EmailLogService.logStub({
        toEmail: cu.email,
        subject: `[KH&CN] Thư mời phiên xét chọn đề tài #${session.id}`,
        body: `Kính mời tham dự phiên xét chọn đề tài.\nNgày họp: ${meetingAt.toFormat('dd/MM/yyyy HH:mm')}\nĐịa điểm: ${payload.location}\nSố hồ sơ: ${hopLe.length}`,
        relatedType: 'proposal_selection_session',
        relatedId: session.id,
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

  /** GET /api/project-proposals/pending-unit-count — badge Khoa */
  async pendingUnitCount({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const canReview = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
    if (!canReview || user.departmentId == null) {
      return response.ok({ success: true, data: { count: 0 } })
    }
    const peerIds = await User.query().where('department_id', user.departmentId).select('id')
    const ids = peerIds.map((u) => u.id)
    if (!ids.length) {
      return response.ok({ success: true, data: { count: 0 } })
    }
    const result = await ProjectProposal.query()
      .where('status', 'SUBMITTED')
      .whereIn('owner_id', ids)
      .count('* as total')
    const count = Number(result[0].$extras.total || 0)
    return response.ok({ success: true, data: { count } })
  }

  /**
   * POST /api/project-proposals/:id/submit-council-adjustment
   * US-03-05: DIEU_CHINH → DUOC_CHON (chỉ title + objectives + giải trình)
   */
  async submitCouncilAdjustment({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(submitCouncilAdjustmentValidator)

    // Từ chối nếu body cố gửi trường bị khóa (EC-02)
    const raw = request.body() as Record<string, unknown>
    const allowed = new Set(['title', 'objectives', 'explanation'])
    const lockedKeys = Object.keys(raw || {}).filter((k) => !allowed.has(k))
    if (lockedKeys.length) {
      return response.unprocessableEntity({
        success: false,
        code: 'LOCKED_FIELDS',
        message: `Không được sửa các trường: ${lockedKeys.join(', ')}. Chỉ được sửa Tên đề tài, Mục tiêu và Ghi chú giải trình.`,
      })
    }

    const explanation = payload.explanation.trim()
    if (explanation.length < 50) {
      return response.unprocessableEntity({
        success: false,
        message: 'Ghi chú giải trình tối thiểu 50 ký tự (sau khi trim).',
      })
    }

    try {
      const result = await db.transaction(async (trx) => {
        const proposal = await ProjectProposal.query({ client: trx })
          .where('id', params.id)
          .forUpdate()
          .first()
        if (!proposal) {
          return { error: 'NOT_FOUND' as const }
        }
        if (!this.isProposalOwner(proposal, user.id)) {
          return { error: 'FORBIDDEN' as const }
        }
        if (proposal.status !== 'DIEU_CHINH') {
          return { error: 'BAD_STATUS' as const, status: proposal.status }
        }
        if (proposal.adjustmentDueAt && DateTime.now() > proposal.adjustmentDueAt) {
          proposal.adjustmentOverdue = true
          await proposal.useTransaction(trx).save()
          return { error: 'OVERDUE' as const }
        }

        const title = payload.title.trim()
        const objectives = payload.objectives.trim()
        const titleChanged = title !== proposal.title.trim()
        const objChanged = objectives !== proposal.objectives.trim()
        if (!titleChanged && !objChanged) {
          return { error: 'NO_CHANGE' as const }
        }

        // Đảm bảo có bản ORIGINAL trước khi ghi đè
        let original = await ProjectProposalAdjustmentVersion.query({ client: trx })
          .where('project_proposal_id', proposal.id)
          .where('version_type', 'ORIGINAL')
          .first()
        if (!original) {
          original = await ProjectProposalAdjustmentVersion.create(
            {
              projectProposalId: proposal.id,
              versionType: 'ORIGINAL',
              title: proposal.title,
              objectives: proposal.objectives,
              councilAdjustmentNote: proposal.councilAdjustmentNote,
              explanationNote: null,
              createdBy: null,
            },
            { client: trx }
          )
        }

        // Không tạo SUBMITTED trùng (EC-01)
        const already = await ProjectProposalAdjustmentVersion.query({ client: trx })
          .where('project_proposal_id', proposal.id)
          .where('version_type', 'SUBMITTED')
          .first()
        if (already) {
          return { error: 'ALREADY_SUBMITTED' as const }
        }

        await ProjectProposalAdjustmentVersion.create(
          {
            projectProposalId: proposal.id,
            versionType: 'SUBMITTED',
            title,
            objectives,
            councilAdjustmentNote: proposal.councilAdjustmentNote,
            explanationNote: explanation,
            createdBy: user.id,
          },
          { client: trx }
        )

        const from = proposal.status
        proposal.title = title
        proposal.objectives = objectives
        proposal.summary = objectives
        proposal.adjustmentExplanation = explanation
        proposal.status = 'DUOC_CHON'
        proposal.canWriteOutline = true
        proposal.adjustmentOverdue = false
        await proposal.useTransaction(trx).save()

        await ProjectProposalAudit.create(
          {
            projectProposalId: proposal.id,
            actorUserId: user.id,
            action: 'COUNCIL_ADJUSTMENT_SUBMIT',
            fromStatus: from,
            toStatus: 'DUOC_CHON',
            note: explanation,
          },
          { client: trx }
        )

        return { proposal, original }
      })

      if ('error' in result && result.error) {
        if (result.error === 'NOT_FOUND') {
          return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
        }
        if (result.error === 'FORBIDDEN') {
          return response.forbidden({ success: false, message: 'Chỉ chủ sở hữu được nộp điều chỉnh.' })
        }
        if (result.error === 'BAD_STATUS') {
          return response.badRequest({
            success: false,
            message: 'Chỉ đề xuất đang Cần điều chỉnh (DIEU_CHINH) mới được nộp lại.',
          })
        }
        if (result.error === 'OVERDUE') {
          return response.unprocessableEntity({
            success: false,
            code: 'ADJUSTMENT_OVERDUE',
            message: 'Đã quá hạn điều chỉnh. Liên hệ PKH để gia hạn.',
          })
        }
        if (result.error === 'NO_CHANGE') {
          return response.unprocessableEntity({
            success: false,
            message: 'Cần cập nhật Tên đề tài và/hoặc Mục tiêu theo yêu cầu Hội đồng.',
          })
        }
        if (result.error === 'ALREADY_SUBMITTED') {
          return response.conflict({
            success: false,
            message: 'Đề xuất đã được nộp điều chỉnh. Tải lại trang.',
          })
        }
      }

      const proposal = (result as { proposal: ProjectProposal }).proposal
      await proposal.load('projectProcessType')
      await NotificationService.push(proposal.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Đã hoàn tất điều chỉnh đề xuất',
        message: `${proposal.code} chuyển sang Được chọn. Bạn có thể Soạn thuyết minh.`,
        link: `/projects/register/form/${proposal.id}`,
      })
      await EmailLogService.logStubToUser(
        proposal.ownerId,
        `[KH&CN] Hoàn tất điều chỉnh đề xuất ${proposal.code}`,
        `Đề xuất "${proposal.title}" đã được cập nhật theo yêu cầu Hội đồng và chuyển sang trạng thái Được chọn. Chức năng Soạn thuyết minh đã mở.`,
        'project_proposal',
        proposal.id
      )

      return response.ok({
        success: true,
        data: this.serialize(proposal),
        message: 'Đã nộp lại điều chỉnh. Trạng thái: Được chọn.',
      })
    } catch (e: any) {
      return response.internalServerError({
        success: false,
        message: e?.message || 'Nộp điều chỉnh thất bại.',
      })
    }
  }

  /** GET /api/project-proposals/:id/adjustment-versions — PKH/GV xem bản gốc & bản sau */
  async adjustmentVersions({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    const isOwner = this.isProposalOwner(proposal, user.id)
    const isPkh = await this.assertPkh(user.id)
    if (!isOwner && !isPkh) {
      return response.forbidden({ success: false, message: 'Không có quyền xem phiên bản điều chỉnh.' })
    }
    const rows = await ProjectProposalAdjustmentVersion.query()
      .where('project_proposal_id', proposal.id)
      .orderBy('id', 'asc')
    return response.ok({
      success: true,
      data: rows.map((v) => ({
        id: v.id,
        versionType: v.versionType,
        title: v.title,
        objectives: v.objectives,
        councilAdjustmentNote: v.councilAdjustmentNote,
        explanationNote: v.explanationNote,
        createdBy: v.createdBy,
        createdAt: v.createdAt.toISO(),
      })),
    })
  }

  /** POST /api/project-proposals/:id/extend-adjustment — PKH gia hạn */
  async extendAdjustment({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertAdjustmentExtend(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH gia hạn điều chỉnh.' })
    }
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'DIEU_CHINH') {
      return response.badRequest({
        success: false,
        message: 'Chỉ gia hạn đề xuất đang Cần điều chỉnh.',
      })
    }
    const payload = await request.validateUsing(extendAdjustmentValidator)
    let due: DateTime | null = null
    if (payload.dueAt) {
      due = DateTime.fromISO(payload.dueAt)
      if (!due.isValid) {
        return response.unprocessableEntity({ success: false, message: 'dueAt không hợp lệ.' })
      }
    } else {
      const days = payload.businessDays ?? 5
      const base = proposal.adjustmentDueAt && proposal.adjustmentDueAt > DateTime.now()
        ? proposal.adjustmentDueAt
        : DateTime.now()
      due = addBusinessDays(base, days)
    }
    proposal.adjustmentDueAt = due
    proposal.adjustmentOverdue = false
    proposal.adjustmentReminderSentAt = null
    await proposal.save()
    await this.writeAudit(
      proposal.id,
      user.id,
      'EXTEND_ADJUSTMENT',
      'DIEU_CHINH',
      'DIEU_CHINH',
      payload.reason || `Gia hạn đến ${due.toFormat('dd/MM/yyyy HH:mm')}`
    )
    await NotificationService.push(proposal.ownerId, {
      type: 'PROJECT_UPDATE',
      title: 'Đã gia hạn điều chỉnh đề xuất',
      message: `${proposal.code}: hạn mới ${due.toFormat('dd/MM/yyyy HH:mm')}.`,
      link: `/projects/register/form/${proposal.id}`,
    })
    return response.ok({ success: true, data: this.serialize(proposal) })
  }
}
