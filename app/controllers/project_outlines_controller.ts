import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectProposal from '#models/project_proposal'
import PermissionService from '#services/permission_service'
import NotificationService from '#services/notification_service'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectOutlineReviewService from '#services/project_outline_review_service'
import ProjectOutlineRevisionService from '#services/project_outline_revision_service'
import {
  updateOutlineDraftValidator,
  submitOutlineRevisionValidator,
  extendOutlineRevisionValidator,
} from '#validators/project_outline_validator'

/**
 * US-04-01 — Soạn / lưu nháp / nộp thuyết minh chi tiết.
 * Dữ liệu nằm ở bảng project_outlines (copy từ đề xuất), không ghi đè proposal.
 */
export default class ProjectOutlinesController {
  private async canViewPkh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage')) ||
      (await PermissionService.userHasPermission(userId, 'project.blind_review_assign')) ||
      (await PermissionService.userHasPermission(userId, 'project.defense_manage')) ||
      (await PermissionService.userHasPermission(userId, 'project.outline_revision_extend'))
    )
  }

  private async canExtendRevision(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.outline_revision_extend')) ||
      (await PermissionService.userHasPermission(userId, 'project.adjustment_extend')) ||
      (await this.canViewPkh(userId))
    )
  }

  private async canManageOwn(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.outline_manage')) ||
      (await PermissionService.userHasPermission(userId, 'project.create')) ||
      (await PermissionService.userHasPermission(userId, 'project.submit')) ||
      (await PermissionService.userHasPermission(userId, 'project.update')) ||
      (await PermissionService.userHasPermission(userId, 'project.view'))
    )
  }

  private async loadFull(id: number) {
    const outline = await ProjectOutline.query()
      .where('id', id)
      .preload('projectProposal')
      .preload('members', (q) =>
        q
          .orderBy('member_order', 'asc')
          .preload('profile', (pq) =>
            pq.select('id', 'gender', 'full_name', 'degree', 'academic_title')
          )
          .preload('student', (sq) => sq.select('id', 'gender', 'full_name'))
      )
      .preload('budgetLines', (q) => q.orderBy('line_order', 'asc'))
      .first()
    return outline
  }

  /** Người đề xuất hoặc Chủ nhiệm đề tài */
  private async assertCanWriteOutline(outline: ProjectOutline, userId: number) {
    const proposal =
      outline.projectProposal || (await ProjectProposal.find(outline.projectProposalId))
    if (!proposal) return false
    return ProjectOutlineService.userCanWriteOutline(proposal, userId)
  }

  /** GET /api/project-outlines/eligible — đề xuất đủ điều kiện soạn TM */
  async eligible({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canManageOwn(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }

    const ids = await ProjectOutlineService.proposalIdsWritableByUser(user.id)
    if (!ids.length) {
      return response.ok({ success: true, data: [] })
    }

    const proposals = await ProjectProposal.query()
      .whereIn('id', ids)
      .orderBy('updated_at', 'desc')

    const outlineRows = await ProjectOutline.query().whereIn('project_proposal_id', ids)
    const byProposal = new Map(outlineRows.map((o) => [o.projectProposalId, o]))

    return response.ok({
      success: true,
      data: proposals.map((p) => {
        const o = byProposal.get(p.id)
        return {
          id: p.id,
          code: p.code,
          title: p.title,
          status: p.status,
          canWriteOutline: p.canWriteOutline,
          ownerUnit: p.ownerUnit,
          councilAdjustmentNote: p.councilAdjustmentNote,
          outlineId: o?.id ?? null,
          outlineCode: o?.code ?? null,
          outlineStatus: o?.status ?? null,
          completionPercent: o?.completionPercent ?? 0,
        }
      }),
    })
  }

  /** GET /api/project-outlines — danh sách thuyết minh của tôi (PKH xem tất cả pending) */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const isPkh = await this.canViewPkh(user.id)
    if (!(await this.canManageOwn(user.id)) && !isPkh) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }

    const status = request.input('status') as string | undefined
    const q = ProjectOutline.query().preload('projectProposal').orderBy('updated_at', 'desc')
    if (isPkh && request.input('scope') === 'pkh') {
      if (status) q.where('status', status)
      else q.where('status', 'THUYETMINH_PENDING')
    } else {
      const writableIds = await ProjectOutlineService.proposalIdsWritableByUser(user.id)
      if (!writableIds.length) {
        return response.ok({ success: true, data: [] })
      }
      q.whereIn('project_proposal_id', writableIds)
      if (status) q.where('status', status)
    }

    const rows = await q
    return response.ok({
      success: true,
      data: rows.map((o) => ProjectOutlineService.serialize(o)),
    })
  }

  /**
   * POST /api/project-outlines/from-proposal/:proposalId
   * Tạo bản nháp (copy đề xuất) hoặc trả về bản hiện có.
   */
  async fromProposal({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canManageOwn(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }

    const proposalId = Number(params.proposalId)
    const proposal = await ProjectProposal.find(proposalId)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (!(await ProjectOutlineService.userCanWriteOutline(proposal, user.id))) {
      return response.forbidden({
        success: false,
        message: 'Chỉ người đề xuất hoặc Chủ nhiệm đề tài được soạn thuyết minh.',
      })
    }

    const gate = ProjectOutlineService.assertEligibleProposal(proposal)
    if (gate) {
      return response.forbidden({ success: false, message: gate })
    }

    const existing = await ProjectOutline.query().where('project_proposal_id', proposal.id).first()
    if (existing) {
      // Bản nháp cũ bị trống → đổ lại field thiếu từ đề xuất
      if (existing.status === 'THUYETMINH_DRAFT') {
        await ProjectOutlineService.syncEmptyFieldsFromProposal(existing, proposal)
        const members = await ProjectOutlineService.loadMembers(existing.id)
        if (!members.length) {
          await proposal.load('members')
          const source = proposal.members?.length
            ? proposal.members
            : [
                {
                  profileId: null,
                  studentId: null,
                  departmentId: null,
                  fullName: proposal.ownerName,
                  memberOrder: 1,
                  role: 'PRINCIPAL',
                  affiliationType: null,
                  affiliationUnits: [] as string[],
                },
              ]
          await ProjectOutlineService.replaceMembers(
            existing.id,
            source.map((m, i) => ({
              profileId: m.profileId ?? null,
              studentId: m.studentId ?? null,
              departmentId: m.departmentId ?? null,
              fullName: m.fullName || proposal.ownerName,
              memberOrder: m.memberOrder ?? i + 1,
              role: String(m.role || 'MEMBER'),
              affiliationType: m.affiliationType ?? null,
              affiliationUnits: m.affiliationUnits ?? [],
              gender: (m as any).gender ?? null,
              isMultiAffiliationOutsideUdn: !!(m as any).isMultiAffiliationOutsideUdn,
              contributionPercent:
                (m as any).contributionPercent != null
                  ? Number((m as any).contributionPercent)
                  : null,
              participationHours: null,
            }))
          )
        }
      }
      const full = await this.loadFull(existing.id)
      const revisionContext =
        full!.status === 'CHINH_SUA_TM' || full!.status === 'CHO_XAC_NHAN_KP'
          ? await ProjectOutlineRevisionService.getRevisionContext(full!)
          : null
      return response.ok({
        success: true,
        data: {
          ...ProjectOutlineService.serialize(full!),
          revisionContext,
        },
        message: 'Đã mở bản thuyết minh hiện có.',
      })
    }

    const created = await ProjectOutlineService.createFromProposal(proposal, user.id)
    const full = await this.loadFull(created.id)
    return response.created({
      success: true,
      data: ProjectOutlineService.serialize(full!),
      message: 'Đã tạo bản nháp thuyết minh từ đề xuất.',
    })
  }

  /** GET /api/project-outlines/:id */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const isPkh = await this.canViewPkh(user.id)
    if (!(await this.assertCanWriteOutline(outline, user.id)) && !isPkh) {
      return response.forbidden({ success: false, message: 'Không có quyền xem.' })
    }
    if (outline.status === 'CHINH_SUA_TM') {
      await ProjectOutlineRevisionService.maybeSendReminder(outline)
    }
    const revisionContext =
      outline.status === 'CHINH_SUA_TM' ||
      outline.status === 'CHO_XAC_NHAN_KP' ||
      outline.defenseConclusion === 'THONG_QUA_DIEU_CHINH'
        ? await ProjectOutlineRevisionService.getRevisionContext(outline)
        : null
    return response.ok({
      success: true,
      data: {
        ...ProjectOutlineService.serialize(outline),
        revisionContext,
      },
    })
  }

  /** PUT /api/project-outlines/:id — lưu nháp */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    if (!(await this.assertCanWriteOutline(outline, user.id))) {
      return response.forbidden({
        success: false,
        message: 'Chỉ người đề xuất hoặc Chủ nhiệm đề tài được lưu nháp.',
      })
    }
    if (outline.status !== 'THUYETMINH_DRAFT' && outline.status !== 'CHINH_SUA_TM') {
      return response.badRequest({
        success: false,
        message: 'Bản thuyết minh không ở trạng thái được phép sửa.',
      })
    }

    if (outline.status === 'CHINH_SUA_TM') {
      if (ProjectOutlineRevisionService.isPastDeadline(outline.revisionDeadline)) {
        return response.unprocessableEntity({
          success: false,
          message: 'Đã quá hạn chỉnh sửa — liên hệ PKH gia hạn.',
        })
      }
    } else {
      const proposal = await ProjectProposal.find(outline.projectProposalId)
      if (!proposal || ProjectOutlineService.assertEligibleProposal(proposal)) {
        return response.forbidden({
          success: false,
          message: 'Đề xuất không còn đủ điều kiện soạn thuyết minh.',
        })
      }
      if (!(await ProjectOutlineService.userCanWriteOutline(proposal, user.id))) {
        return response.forbidden({
          success: false,
          message: 'Chỉ người đề xuất hoặc Chủ nhiệm đề tài được lưu nháp.',
        })
      }
    }

    const payload = await request.validateUsing(updateOutlineDraftValidator)
    ProjectOutlineService.applyDraftFields(outline, payload)
    if (payload.revisionExplanation !== undefined) {
      outline.revisionExplanation = payload.revisionExplanation?.trim() || null
    }

    if (payload.members) {
      await ProjectOutlineService.replaceMembers(outline.id, payload.members)
    }
    if (payload.budgetLines) {
      await ProjectOutlineService.replaceBudgetLines(outline.id, payload.budgetLines)
    }

    const members = await ProjectOutlineService.loadMembers(outline.id)
    const budgetLines = await ProjectOutlineService.loadBudgetLines(outline.id)
    outline.completionPercent = ProjectOutlineService.calcCompletion(outline, members, budgetLines)
    await outline.save()

    if (outline.status === 'CHINH_SUA_TM') {
      await ProjectOutlineService.writeAudit(
        outline.id,
        user.id,
        'SAVE_REVISION_DRAFT',
        'CHINH_SUA_TM',
        'CHINH_SUA_TM'
      )
    } else {
      await ProjectOutlineService.writeAudit(
        outline.id,
        user.id,
        'SAVE_DRAFT',
        'THUYETMINH_DRAFT',
        'THUYETMINH_DRAFT'
      )
    }

    const full = await this.loadFull(outline.id)
    const revisionContext =
      full!.status === 'CHINH_SUA_TM'
        ? await ProjectOutlineRevisionService.getRevisionContext(full!)
        : null
    return response.ok({
      success: true,
      data: {
        ...ProjectOutlineService.serialize(full!),
        revisionContext,
      },
      message:
        outline.status === 'CHINH_SUA_TM'
          ? 'Đã lưu nháp bản chỉnh sửa (bản đã đánh giá bởi HĐ không bị ghi đè).'
          : 'Đã lưu nháp thuyết minh.',
    })
  }

  /** POST /api/project-outlines/:id/submit */
  async submit({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    if (!(await this.assertCanWriteOutline(outline, user.id))) {
      return response.forbidden({
        success: false,
        message: 'Chỉ người đề xuất hoặc Chủ nhiệm đề tài được nộp thuyết minh.',
      })
    }
    if (outline.status !== 'THUYETMINH_DRAFT') {
      return response.badRequest({
        success: false,
        message: 'Bản thuyết minh đã được nộp hoặc không ở trạng thái nháp.',
      })
    }

    const proposal = await ProjectProposal.find(outline.projectProposalId)
    if (!proposal || ProjectOutlineService.assertEligibleProposal(proposal)) {
      return response.forbidden({
        success: false,
        message: 'Đề xuất không còn đủ điều kiện nộp thuyết minh.',
      })
    }

    const members = outline.members || []
    const budgetLines = outline.budgetLines || []
    const errors = ProjectOutlineService.validateForSubmit(outline, members, budgetLines)
    if (errors.length) {
      return response.unprocessableEntity({
        success: false,
        message: errors[0],
        errors,
      })
    }

    const from = outline.status
    outline.status = 'THUYETMINH_PENDING'
    outline.submittedBy = user.id
    outline.submittedAt = DateTime.now()
    outline.withdrawnAt = null
    outline.completionPercent = 100
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      user.id,
      'SUBMIT',
      from,
      'THUYETMINH_PENDING'
    )

    await NotificationService.notifyPkhOutlineSubmitted({
      id: outline.id,
      code: outline.code,
      title: outline.title,
      ownerName: outline.ownerName,
    })

    const full = await this.loadFull(outline.id)
    return response.ok({
      success: true,
      data: ProjectOutlineService.serialize(full!),
      message: 'Đã nộp thuyết minh chính thức. Phòng Khoa học đã nhận thông báo.',
    })
  }

  /**
   * POST /api/project-outlines/:id/withdraw
   * Rút lại khi PENDING và chưa phân công phản biện (US-04-02 chưa có → luôn cho rút).
   */
  async withdraw({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    if (!(await this.assertCanWriteOutline(outline, user.id))) {
      return response.forbidden({
        success: false,
        message: 'Chỉ người đề xuất hoặc Chủ nhiệm đề tài được rút lại.',
      })
    }
    if (outline.status !== 'THUYETMINH_PENDING') {
      return response.badRequest({
        success: false,
        message: 'Chỉ rút lại khi đang chờ PKH tiếp nhận.',
      })
    }

    // US-04-02: đã phân công phản biện thì không rút
    if (await ProjectOutlineReviewService.hasActiveReviewProcess(outline.id)) {
      return response.badRequest({
        success: false,
        message: 'Đã phân công phản biện — không thể rút lại thuyết minh.',
      })
    }

    const from = outline.status
    outline.status = 'THUYETMINH_DRAFT'
    outline.withdrawnAt = DateTime.now()
    outline.submittedAt = null
    outline.submittedBy = null
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      user.id,
      'WITHDRAW',
      from,
      'THUYETMINH_DRAFT'
    )

    const full = await this.loadFull(outline.id)
    return response.ok({
      success: true,
      data: ProjectOutlineService.serialize(full!),
      message: 'Đã rút lại thuyết minh — trở về bản nháp.',
    })
  }

  /** GET /api/project-outlines/:id/revision-context */
  async revisionContext({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const isPkh = await this.canViewPkh(user.id)
    if (!(await this.assertCanWriteOutline(outline, user.id)) && !isPkh) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    if (outline.status === 'CHINH_SUA_TM') {
      await ProjectOutlineRevisionService.maybeSendReminder(outline)
    }
    const data = await ProjectOutlineRevisionService.getRevisionContext(outline)
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outlines/:id/versions */
  async versions({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const isPkh = await this.canViewPkh(user.id)
    if (!(await this.assertCanWriteOutline(outline, user.id)) && !isPkh) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const { default: ProjectOutlineVersion } = await import('#models/project_outline_version')
    const rows = await ProjectOutlineVersion.query()
      .where('project_outline_id', outline.id)
      .orderBy('version_no', 'asc')
    return response.ok({
      success: true,
      data: rows.map((v) => ProjectOutlineRevisionService.serializeVersion(v)),
    })
  }

  /** GET /api/project-outlines/:id/revision-diff */
  async revisionDiff({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const isPkh = await this.canViewPkh(user.id)
    if (!(await this.assertCanWriteOutline(outline, user.id)) && !isPkh) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const fromId = request.input('fromVersionId')
      ? Number(request.input('fromVersionId'))
      : undefined
    const toId = request.input('toVersionId')
      ? Number(request.input('toVersionId'))
      : undefined
    const data = await ProjectOutlineRevisionService.compareVersions(outline.id, fromId, toId)
    return response.ok({ success: true, data })
  }

  /** POST /api/project-outlines/:id/submit-revision — nộp bản hoàn thiện */
  async submitRevision({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    if (!(await this.assertCanWriteOutline(outline, user.id))) {
      return response.forbidden({
        success: false,
        message: 'Chỉ người đề xuất hoặc Chủ nhiệm đề tài được nộp bản hoàn thiện.',
      })
    }
    const payload = await request.validateUsing(submitOutlineRevisionValidator)
    try {
      const result = await ProjectOutlineRevisionService.submitRevision(
        outline,
        user.id,
        payload.explanation
      )
      const full = await this.loadFull(result.outline.id)
      const revisionContext = await ProjectOutlineRevisionService.getRevisionContext(full!)
      return response.ok({
        success: true,
        message: result.idempotent
          ? 'Bản hoàn thiện đã được nộp trước đó.'
          : 'Đã nộp bản hoàn thiện — chuyển chờ xác nhận kinh phí.',
        data: {
          ...ProjectOutlineService.serialize(full!),
          revisionContext,
          submittedVersion: ProjectOutlineRevisionService.serializeVersion(result.version),
        },
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Nộp bản hoàn thiện thất bại.',
      })
    }
  }

  /** POST /api/project-outlines/:id/extend-revision-deadline — PKH gia hạn */
  async extendRevisionDeadline({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canExtendRevision(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH gia hạn.' })
    }
    const outline = await this.loadFull(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const payload = await request.validateUsing(extendOutlineRevisionValidator)
    try {
      await ProjectOutlineRevisionService.extendDeadline(
        outline,
        user.id,
        payload.deadlineAt,
        payload.reason
      )
      const full = await this.loadFull(outline.id)
      const revisionContext = await ProjectOutlineRevisionService.getRevisionContext(full!)
      return response.ok({
        success: true,
        message: 'Đã gia hạn chỉnh sửa thuyết minh.',
        data: {
          ...ProjectOutlineService.serialize(full!),
          revisionContext,
        },
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Gia hạn thất bại.',
      })
    }
  }
}
