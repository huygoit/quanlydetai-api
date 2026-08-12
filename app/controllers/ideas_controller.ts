import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Idea from '#models/idea'
import AuditLogService from '#services/audit_log_service'
import NotificationService from '#services/notification_service'
import IdeaPermissionService from '#services/idea_permission_service'
import {
  createIdeaValidator,
  updateIdeaValidator,
  rejectIdeaValidator,
  approveInternalValidator,
  proposeOrderValidator,
  approveOrderValidator,
  councilResultValidator,
} from '#validators/idea_validator'
import type { IdeaStatus } from '#models/idea'
import { resolveUserUnitLabel } from '#utils/user_unit'
import { areActiveProcessTypeCodes, isActiveFieldName } from '#utils/catalog_assert'
import IdeaToProposalService from '#services/idea_to_proposal_service'
import ProjectProposal from '#models/project_proposal'

/**
 * API Ngân hàng ý tưởng: CRUD, workflow (submit, receive, approve, reject), create-project, council-result.
 */
export default class IdeasController {
  private serializeIdea(idea: Idea, linkedProposalId?: number | null) {
    return {
      id: idea.id,
      code: idea.code,
      title: idea.title,
      summary: idea.summary,
      field: idea.field,
      suitableLevels: idea.suitableLevels ?? [],
      ownerId: idea.ownerId,
      ownerName: idea.ownerName,
      ownerUnit: idea.ownerUnit,
      status: idea.status,
      priority: idea.priority,
      noteForReview: idea.noteForReview,
      rejectedStage: idea.rejectedStage,
      rejectedReason: idea.rejectedReason,
      rejectedByRole: idea.rejectedByRole,
      rejectedAt: idea.rejectedAt ? idea.rejectedAt.toISO() : null,
      linkedProjectId: idea.linkedProjectId,
      linkedProposalId: linkedProposalId ?? null,
      councilSessionId: idea.councilSessionId,
      councilAvgWeightedScore: idea.councilAvgWeightedScore != null ? Number(idea.councilAvgWeightedScore) : null,
      councilAvgNoveltyScore: idea.councilAvgNoveltyScore != null ? Number(idea.councilAvgNoveltyScore) : null,
      councilAvgFeasibilityScore: idea.councilAvgFeasibilityScore != null ? Number(idea.councilAvgFeasibilityScore) : null,
      councilAvgAlignmentScore: idea.councilAvgAlignmentScore != null ? Number(idea.councilAvgAlignmentScore) : null,
      councilAvgAuthorCapacityScore: idea.councilAvgAuthorCapacityScore != null ? Number(idea.councilAvgAuthorCapacityScore) : null,
      councilSubmittedCount: idea.councilSubmittedCount,
      councilMemberCount: idea.councilMemberCount,
      councilRecommendation: idea.councilRecommendation,
      councilScoredAt: idea.councilScoredAt ? idea.councilScoredAt.toISO() : null,
      createdAt: idea.createdAt.toISO(),
      updatedAt: idea.updatedAt.toISO(),
    }
  }

  private isOwner(idea: Idea, userId: number): boolean {
    return Number(idea.ownerId) === Number(userId)
  }

  private serializeListItem(idea: Idea, linkedProposalId?: number | null) {
    return {
      id: idea.id,
      code: idea.code,
      title: idea.title,
      summary: idea.summary,
      field: idea.field,
      suitableLevels: idea.suitableLevels ?? [],
      ownerId: idea.ownerId,
      ownerName: idea.ownerName,
      ownerUnit: idea.ownerUnit,
      status: idea.status,
      priority: idea.priority,
      linkedProjectId: idea.linkedProjectId,
      linkedProposalId: linkedProposalId ?? null,
      createdAt: idea.createdAt.toISO(),
      updatedAt: idea.updatedAt.toISO(),
    }
  }

  /** Map ideaId → proposalId từ source_idea_id */
  private async mapLinkedProposalIds(ideaIds: number[]): Promise<Map<number, number>> {
    const map = new Map<number, number>()
    if (ideaIds.length === 0) return map
    const rows = await ProjectProposal.query()
      .whereIn('source_idea_id', ideaIds)
      .select('id', 'source_idea_id')
    for (const row of rows) {
      if (row.sourceIdeaId != null) map.set(Number(row.sourceIdeaId), Number(row.id))
    }
    return map
  }

  /**
   * GET /api/ideas/my - Chỉ lấy ý tưởng của user đang đăng nhập (dùng cho trang "Ý tưởng của tôi")
   */
  async myIndex({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const keyword = request.input('keyword', '')
    const field = request.input('field', '')
    const status = request.input('status', '')
    const suitableLevels = request.input('suitableLevels') ?? request.input('suitableLevels[]')
    const priority = request.input('priority', '')

    const q = Idea.query().where('owner_id', user.id).orderBy('updated_at', 'desc')
    if (keyword) {
      q.where((b) => {
        b.whereILike('code', `%${keyword}%`)
          .orWhereILike('title', `%${keyword}%`)
          .orWhereILike('summary', `%${keyword}%`)
      })
    }
    if (field) q.where('field', field)
    if (status) q.where('status', status)
    if (priority) q.where('priority', priority)
    const levels = Array.isArray(suitableLevels) ? suitableLevels : suitableLevels ? [suitableLevels] : []
    if (levels.length > 0) q.whereRaw('suitable_levels ?| ?::text[]', [levels])

    const paginated = await q.paginate(page, perPage)
    const rows = paginated.all()
    const linkMap = await this.mapLinkedProposalIds(rows.map((i) => i.id))
    const data = rows.map((i) => this.serializeListItem(i, linkMap.get(i.id) ?? null))
    return response.ok({
      success: true,
      data,
      meta: { total: paginated.total, currentPage: paginated.currentPage, perPage: paginated.perPage, lastPage: paginated.lastPage },
    })
  }

  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = Math.min(request.input('perPage', 10), 100)
    const keyword = request.input('keyword', '')
    const field = request.input('field', '')
    const unit = request.input('unit', '') || request.input('ownerUnit', '')
    const status = request.input('status', '')
    const suitableLevels = request.input('suitableLevels') ?? request.input('suitableLevels[]')
    const priority = request.input('priority', '')
    const ownerId = request.input('ownerId', '')

    const q = Idea.query().orderBy('updated_at', 'desc')
    if (keyword) {
      q.where((b) => {
        b.whereILike('code', `%${keyword}%`)
          .orWhereILike('title', `%${keyword}%`)
          .orWhereILike('summary', `%${keyword}%`)
      })
    }
    if (field) q.where('field', field)
    if (unit) q.whereILike('owner_unit', `%${unit}%`)
    if (status) q.where('status', status)
    if (priority) q.where('priority', priority)
    if (ownerId) q.where('owner_id', ownerId)
    const levels = Array.isArray(suitableLevels) ? suitableLevels : suitableLevels ? [suitableLevels] : []
    if (levels.length > 0) q.whereRaw('suitable_levels ?| ?::text[]', [levels])

    const paginated = await q.paginate(page, perPage)
    const rows = paginated.all()
    const linkMap = await this.mapLinkedProposalIds(rows.map((i) => i.id))
    const data = rows.map((i) => this.serializeListItem(i, linkMap.get(i.id) ?? null))
    return response.ok({
      success: true,
      data,
      meta: { total: paginated.total, currentPage: paginated.currentPage, perPage: paginated.perPage, lastPage: paginated.lastPage },
    })
  }

  async show({ params, response }: HttpContext) {
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    const linkMap = await this.mapLinkedProposalIds([idea.id])
    return response.ok({
      success: true,
      data: this.serializeIdea(idea, linkMap.get(idea.id) ?? null),
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(createIdeaValidator)

    if (!(await isActiveFieldName(payload.field))) {
      return response.badRequest({ success: false, message: 'Lĩnh vực không thuộc danh mục.' })
    }
    const levels = payload.suitableLevels ?? []
    if (levels.length > 0 && !(await areActiveProcessTypeCodes(levels))) {
      return response.badRequest({
        success: false,
        message: 'Cấp ý tưởng/đề tài không thuộc danh mục.',
      })
    }

    const code = await Idea.generateCode()
    const ownerUnit = await resolveUserUnitLabel(user)
    const idea = await Idea.create({
      code,
      title: payload.title,
      summary: payload.summary,
      field: payload.field,
      suitableLevels: levels,
      ownerId: user.id,
      ownerName: user.fullName,
      ownerUnit,
      status: 'DRAFT',
    })
    return response.created({ success: true, data: this.serializeIdea(idea) })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (!this.isOwner(idea, user.id)) return response.forbidden({ success: false, message: 'Chỉ chủ sở hữu mới được sửa.' })
    if (idea.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ được sửa khi trạng thái DRAFT.' })
    const payload = await request.validateUsing(updateIdeaValidator)
    if (payload.field !== undefined && !(await isActiveFieldName(payload.field))) {
      return response.badRequest({ success: false, message: 'Lĩnh vực không thuộc danh mục.' })
    }
    if (
      payload.suitableLevels !== undefined &&
      payload.suitableLevels.length > 0 &&
      !(await areActiveProcessTypeCodes(payload.suitableLevels))
    ) {
      return response.badRequest({
        success: false,
        message: 'Cấp ý tưởng/đề tài không thuộc danh mục.',
      })
    }
    if (payload.title !== undefined) idea.title = payload.title
    if (payload.summary !== undefined) idea.summary = payload.summary
    if (payload.field !== undefined) idea.field = payload.field
    if (payload.suitableLevels !== undefined) idea.suitableLevels = payload.suitableLevels ?? []
    await idea.save()
    return response.ok({ success: true, data: this.serializeIdea(idea) })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (!this.isOwner(idea, user.id)) return response.forbidden({ success: false, message: 'Chỉ chủ sở hữu mới được xóa.' })
    if (idea.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ được xóa khi trạng thái DRAFT.' })
    await idea.delete()
    return response.ok({ success: true, message: 'Đã xóa ý tưởng.' })
  }

  async submit(ctx: HttpContext) {
    const { auth, params, response } = ctx
    const user = auth.use('api').user!
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (!this.isOwner(idea, user.id)) return response.forbidden({ success: false, message: 'Chỉ chủ sở hữu mới được gửi.' })
    if (idea.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ gửi được khi trạng thái DRAFT.' })
    idea.status = 'SUBMITTED'
    await idea.save()
    await AuditLogService.log({ userId: user.id, userName: user.fullName, action: 'SUBMIT', entityType: 'IDEA', entityId: String(idea.id), newData: this.serializeIdea(idea), ctx })
    await NotificationService.notifyIdeaSubmitted(idea.code, idea.title, idea.id, idea.ownerName)
    return response.ok({ success: true, message: 'Đã gửi ý tưởng.', data: this.serializeIdea(idea) })
  }

  async receive({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canReceive = await IdeaPermissionService.canReceiveIdea(user)
    if (!canReceive) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được nhận sơ loại.' })
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (idea.status !== 'SUBMITTED') return response.badRequest({ success: false, message: 'Chỉ nhận khi trạng thái SUBMITTED.' })
    idea.status = 'APPROVED_INTERNAL'
    await idea.save()
    await NotificationService.notifyIdeaStatusChanged(idea.ownerId, idea.code, 'APPROVED_INTERNAL', idea.id)
    return response.ok({ success: true, message: 'Đã tiếp nhận (sơ loại đạt).', data: this.serializeIdea(idea) })
  }

  async approveInternal({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canApprove = await IdeaPermissionService.canApproveInternalIdea(user)
    if (!canApprove) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được duyệt sơ loại.' })
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (idea.status !== 'REVIEWING') return response.badRequest({ success: false, message: 'Chỉ duyệt sơ loại khi trạng thái REVIEWING.' })
    const payload = await request.validateUsing(approveInternalValidator)
    idea.status = 'APPROVED_INTERNAL'
    if (payload.priority !== undefined) idea.priority = payload.priority ?? null
    if (payload.noteForReview !== undefined) idea.noteForReview = payload.noteForReview ?? null
    await idea.save()
    await NotificationService.notifyIdeaStatusChanged(idea.ownerId, idea.code, 'APPROVED_INTERNAL', idea.id)
    return response.ok({ success: true, message: 'Đã duyệt sơ loại.', data: this.serializeIdea(idea) })
  }

  async proposeOrder({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canPropose = await IdeaPermissionService.canProposeOrder(user)
    if (!canPropose) return response.forbidden({ success: false, message: 'Chỉ Hội đồng được đề xuất đặt hàng.' })
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (idea.status !== 'APPROVED_INTERNAL') return response.badRequest({ success: false, message: 'Chỉ đề xuất đặt hàng khi trạng thái APPROVED_INTERNAL.' })
    const payload = await request.validateUsing(proposeOrderValidator)
    idea.status = 'PROPOSED_FOR_ORDER'
    if (payload.priority !== undefined) idea.priority = payload.priority ?? null
    if (payload.noteForReview !== undefined) idea.noteForReview = payload.noteForReview ?? null
    await idea.save()
    await NotificationService.notifyIdeaStatusChanged(idea.ownerId, idea.code, 'PROPOSED_FOR_ORDER', idea.id)
    return response.ok({ success: true, message: 'Đã đề xuất đặt hàng.', data: this.serializeIdea(idea) })
  }

  async approveOrder({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canApprove = await IdeaPermissionService.canApproveOrder(user)
    if (!canApprove) return response.forbidden({ success: false, message: 'Chỉ Lãnh đạo được phê duyệt đặt hàng.' })
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (idea.status !== 'PROPOSED_FOR_ORDER') {
      return response.badRequest({
        success: false,
        message: 'Chỉ phê duyệt đặt hàng khi trạng thái PROPOSED_FOR_ORDER.',
      })
    }
    const payload = await request.validateUsing(approveOrderValidator)
    idea.status = 'APPROVED_FOR_ORDER'
    if (payload.noteForReview !== undefined) idea.noteForReview = payload.noteForReview ?? null
    await idea.save()

    // Tự động tạo đề xuất đề tài (DRAFT) và copy thông tin từ ý tưởng
    let proposalPayload: { id: number; code: string; created: boolean } | null = null
    try {
      const result = await IdeaToProposalService.createDraftFromIdea(idea, user.id)
      proposalPayload = {
        id: result.proposal.id,
        code: result.proposal.code,
        created: result.created,
      }
    } catch (err) {
      if ((err as Error).message === 'NO_ACTIVE_PROCESS_TYPE') {
        return response.unprocessableEntity({
          success: false,
          message:
            'Đã phê duyệt đặt hàng nhưng chưa tạo được đề xuất: thiếu danh mục Cấp ý tưởng/đề tài (QT).',
          data: this.serializeIdea(idea),
        })
      }
      throw err
    }

    await NotificationService.notifyIdeaStatusChanged(idea.ownerId, idea.code, 'APPROVED_FOR_ORDER', idea.id)
    await idea.refresh()
    return response.ok({
      success: true,
      message: proposalPayload?.created
        ? `Đã phê duyệt đặt hàng và tạo đề xuất ${proposalPayload.code}.`
        : 'Đã phê duyệt đặt hàng.',
      data: this.serializeIdea(idea, proposalPayload?.id ?? null),
      proposal: proposalPayload,
    })
  }

  async reject({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canReject = await IdeaPermissionService.canRejectIdea(user)
    if (!canReject) return response.forbidden({ success: false, message: 'Bạn không có quyền từ chối ý tưởng.' })
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (idea.status === 'REJECTED') return response.badRequest({ success: false, message: 'Ý tưởng đã bị từ chối.' })
    const payload = await request.validateUsing(rejectIdeaValidator)
    const stage = this.getRejectedStage(idea.status)
    idea.status = 'REJECTED'
    idea.rejectedStage = stage
    idea.rejectedReason = payload.rejectedReason
    idea.rejectedByRole = user.role
    idea.rejectedAt = DateTime.now()
    await idea.save()
    await NotificationService.notifyIdeaStatusChanged(idea.ownerId, idea.code, 'REJECTED', idea.id)
    return response.ok({ success: true, message: 'Đã từ chối ý tưởng.', data: this.serializeIdea(idea) })
  }

  private getRejectedStage(status: IdeaStatus): 'PHONG_KH_SO_LOAI' | 'HOI_DONG_DE_XUAT' | 'LANH_DAO_PHE_DUYET' {
    if (status === 'SUBMITTED' || status === 'REVIEWING') return 'PHONG_KH_SO_LOAI'
    if (status === 'APPROVED_INTERNAL') return 'HOI_DONG_DE_XUAT'
    if (status === 'PROPOSED_FOR_ORDER') return 'LANH_DAO_PHE_DUYET'
    return 'PHONG_KH_SO_LOAI'
  }

  async createProject({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canCreate = await IdeaPermissionService.canCreateProjectFromIdea(user)
    if (!canCreate) {
      return response.forbidden({
        success: false,
        message: 'Chỉ Phòng KH hoặc Admin được tạo đề tài từ ý tưởng.',
      })
    }
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    if (idea.status !== 'APPROVED_FOR_ORDER') {
      return response.badRequest({
        success: false,
        message: 'Chỉ tạo đề tài khi trạng thái APPROVED_FOR_ORDER.',
      })
    }

    try {
      const result = await IdeaToProposalService.createDraftFromIdea(idea, user.id)
      await idea.refresh()
      return response.ok({
        success: true,
        message: result.created
          ? `Đã tạo đề xuất ${result.proposal.code} từ ý tưởng.`
          : `Đề xuất ${result.proposal.code} đã tồn tại.`,
        data: {
          ideaId: idea.id,
          linkedProjectId: result.proposal.code,
          linkedProposalId: result.proposal.id,
          created: result.created,
        },
      })
    } catch (err) {
      if ((err as Error).message === 'NO_ACTIVE_PROCESS_TYPE') {
        return response.unprocessableEntity({
          success: false,
          message: 'Thiếu danh mục Cấp ý tưởng/đề tài (QT) đang hoạt động.',
        })
      }
      throw err
    }
  }

  async councilResult({ params, request, response }: HttpContext) {
    const idea = await Idea.find(params.id)
    if (!idea) return response.notFound({ success: false, message: 'Không tìm thấy ý tưởng.' })
    const payload = await request.validateUsing(councilResultValidator)
    idea.councilSessionId = payload.councilSessionId
    idea.councilAvgWeightedScore = payload.councilAvgWeightedScore
    idea.councilAvgNoveltyScore = payload.councilAvgNoveltyScore
    idea.councilAvgFeasibilityScore = payload.councilAvgFeasibilityScore
    idea.councilAvgAlignmentScore = payload.councilAvgAlignmentScore
    idea.councilAvgAuthorCapacityScore = payload.councilAvgAuthorCapacityScore
    idea.councilSubmittedCount = payload.councilSubmittedCount
    idea.councilMemberCount = payload.councilMemberCount
    idea.councilRecommendation = payload.councilRecommendation
    idea.councilScoredAt = DateTime.now()

    if (payload.councilRecommendation === 'PROPOSE_ORDER' && payload.councilAvgWeightedScore >= 7.0) {
      idea.status = 'PROPOSED_FOR_ORDER'
      await idea.save()
      await NotificationService.notifyIdeaStatusChanged(idea.ownerId, idea.code, 'PROPOSED_FOR_ORDER', idea.id)
    } else if (payload.councilRecommendation === 'NOT_PROPOSE') {
      idea.status = 'REJECTED'
      idea.rejectedStage = 'HOI_DONG_DE_XUAT'
      idea.rejectedReason = 'Hội đồng không đề xuất đặt hàng.'
      idea.rejectedAt = DateTime.now()
      await idea.save()
      await NotificationService.notifyIdeaStatusChanged(idea.ownerId, idea.code, 'REJECTED', idea.id)
    } else {
      await idea.save()
    }
    return response.ok({ success: true, message: 'Đã cập nhật kết quả hội đồng.', data: this.serializeIdea(idea) })
  }
}
