import type { HttpContext } from '@adonisjs/core/http'
import ProjectProposal from '#models/project_proposal'
import AuditLogService from '#services/audit_log_service'
import NotificationService from '#services/notification_service'
import PermissionService from '#services/permission_service'
import {
  createProjectProposalValidator,
  updateProjectProposalValidator,
  unitReviewProposalValidator,
  sciDeptReviewProposalValidator,
} from '#validators/project_proposal_validator'
import type { ProjectProposalStatus } from '#models/project_proposal'

/**
 * API Đăng ký đề xuất đề tài: CRUD, submit, withdraw, unit-review, sci-dept-review.
 */
export default class ProjectProposalsController {
  /** Serialize đầy đủ cho GET :id */
  private serialize(p: ProjectProposal) {
    const rot = p.researchOutputType
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
    }
  }

  /** Serialize cho danh sách */
  private serializeListItem(p: ProjectProposal) {
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
      createdAt: p.createdAt.toISO(),
      updatedAt: p.updatedAt.toISO(),
    }
  }

  /**
   * GET /api/project-proposals
   * Query: keyword, year, status, level, field, unit, ownerOnly, page, perPage
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

    const q = ProjectProposal.query().orderBy('updated_at', 'desc')

    if (keyword) {
      q.where((b) => {
        b.whereILike('code', `%${keyword}%`)
          .orWhereILike('title', `%${keyword}%`)
          .orWhereILike('owner_name', `%${keyword}%`)
      })
    }
    if (year) q.where('year', year)
    if (status) q.where('status', status)
    if (level) q.where('level', level)
    if (field) q.where('field', field)
    if (unit) q.whereILike('owner_unit', `%${unit}%`)

    if (ownerOnly) {
      q.where('owner_id', user.id)
    } else {
      const hasViewAll = await PermissionService.userHasPermission(user.id, 'project.view')
      const hasUnitReview = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
      if (hasUnitReview && user.unit) {
        q.where('owner_unit', user.unit)
      } else if (!hasViewAll) {
        q.where('owner_id', user.id)
      }
    }

    const paginated = await q.paginate(page, perPage)
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
    const proposal = await ProjectProposal.query().where('id', params.id).preload('researchOutputType').first()
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(createProjectProposalValidator)
    const code = await ProjectProposal.generateCode(payload.year)

    const proposal = await ProjectProposal.create({
      code,
      title: payload.title,
      field: payload.field,
      level: payload.level,
      year: payload.year,
      durationMonths: payload.durationMonths,
      keywords: payload.keywords ?? [],
      ownerId: user.id,
      ownerName: user.fullName,
      ownerEmail: user.email,
      ownerUnit: user.unit ?? '',
      coAuthors: payload.coAuthors ?? [],
      objectives: payload.objectives,
      summary: payload.summary,
      contentOutline: payload.contentOutline ?? null,
      expectedResults: payload.expectedResults ?? null,
      applicationPotential: payload.applicationPotential ?? null,
      requestedBudgetTotal: payload.requestedBudgetTotal ?? null,
      requestedBudgetDetail: payload.requestedBudgetDetail ?? null,
      researchOutputTypeId: payload.researchOutputTypeId ?? null,
      status: 'DRAFT',
    })
    return response.created({ success: true, data: this.serialize(proposal) })
  }

  /** PUT /api/project-proposals/:id - Chỉ DRAFT, chỉ owner */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'DRAFT') {
      return response.badRequest({
        success: false,
        message: 'Chỉ được sửa đề xuất ở trạng thái Nháp.',
      })
    }
    if (proposal.ownerId !== user.id) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền sửa đề xuất này.' })
    }

    const payload = await request.validateUsing(updateProjectProposalValidator)
    proposal.merge(payload)
    await proposal.save()
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** DELETE /api/project-proposals/:id - Chỉ DRAFT, chỉ owner */
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
    if (proposal.ownerId !== user.id) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền xóa đề xuất này.' })
    }
    await proposal.delete()
    return response.ok({ success: true, message: 'Đã xóa đề xuất.' })
  }

  /** POST /api/project-proposals/:id/submit - DRAFT → SUBMITTED, chỉ owner */
  async submit(ctx: HttpContext) {
    const { auth, params, response } = ctx
    const user = auth.use('api').user!
    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'DRAFT') {
      return response.badRequest({
        success: false,
        message: 'Chỉ được gửi đề xuất ở trạng thái Nháp.',
      })
    }
    if (proposal.ownerId !== user.id) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền gửi đề xuất này.' })
    }

    proposal.status = 'SUBMITTED'
    await proposal.save()

    await AuditLogService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'SUBMIT',
      entityType: 'PROJECT_PROPOSAL',
      entityId: String(proposal.id),
      newData: this.serialize(proposal),
      ctx,
    })
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals/:id/withdraw - SUBMITTED → WITHDRAWN, chỉ owner */
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
        message: 'Chỉ được rút đề xuất đã gửi.',
      })
    }
    if (proposal.ownerId !== user.id) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền rút đề xuất này.' })
    }

    const oldData = this.serialize(proposal)
    proposal.status = 'WITHDRAWN'
    await proposal.save()

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

  /** POST /api/project-proposals/:id/unit-review - project.assign_reviewer, SUBMITTED → UNIT_REVIEWED */
  async unitReview({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canReview = await PermissionService.userHasPermission(user.id, 'project.assign_reviewer')
    if (!canReview) {
      return response.forbidden({
        success: false,
        message: 'Chỉ Trưởng đơn vị được cho ý kiến đề xuất.',
      })
    }

    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'SUBMITTED') {
      return response.badRequest({
        success: false,
        message: 'Chỉ được cho ý kiến đề xuất đã gửi.',
      })
    }
    const currentUserUnit = user.unit
    if (!currentUserUnit || proposal.ownerUnit !== currentUserUnit) {
      return response.forbidden({
        success: false,
        message: 'Bạn không có quyền duyệt đề xuất của đơn vị khác.',
      })
    }

    const payload = await request.validateUsing(unitReviewProposalValidator)
    proposal.unitApproved = payload.unitApproved
    proposal.unitComment = payload.unitComment
    proposal.status = 'UNIT_REVIEWED'
    await proposal.save()

    await NotificationService.notifyProjectProposalStatusChanged(
      proposal.ownerId,
      proposal.code,
      'UNIT_REVIEWED',
      proposal.id
    )
    return response.ok({ success: true, data: this.serialize(proposal) })
  }

  /** POST /api/project-proposals/:id/sci-dept-review - project.review, UNIT_REVIEWED → APPROVED | REJECTED */
  async sciDeptReview({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canReview = await PermissionService.userHasPermission(user.id, 'project.review')
    if (!canReview) {
      return response.forbidden({
        success: false,
        message: 'Chỉ Phòng Khoa học được phê duyệt đề xuất.',
      })
    }

    const proposal = await ProjectProposal.find(params.id)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (proposal.status !== 'UNIT_REVIEWED') {
      return response.badRequest({
        success: false,
        message: 'Chỉ được phê duyệt đề xuất đã có ý kiến đơn vị.',
      })
    }

    const payload = await request.validateUsing(sciDeptReviewProposalValidator)
    proposal.status = payload.status
    proposal.sciDeptPriority = payload.sciDeptPriority ?? null
    proposal.sciDeptComment = payload.sciDeptComment ?? null
    await proposal.save()

    await NotificationService.notifyProjectProposalStatusChanged(
      proposal.ownerId,
      proposal.code,
      payload.status,
      proposal.id
    )
    return response.ok({ success: true, data: this.serialize(proposal) })
  }
}
