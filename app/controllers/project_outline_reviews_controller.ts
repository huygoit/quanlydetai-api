import type { HttpContext } from '@adonisjs/core/http'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineReviewAssignment from '#models/project_outline_review_assignment'
import ProjectProposal from '#models/project_proposal'
import ScientificProfile from '#models/scientific_profile'
import PermissionService from '#services/permission_service'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectOutlineReviewService, {
  DEFAULT_REVIEWER_COUNT,
  WORKLOAD_WARN_THRESHOLD,
} from '#services/project_outline_review_service'
import {
  assignOutlineReviewersValidator,
  replaceOutlineReviewerValidator,
} from '#validators/project_outline_review_validator'

/**
 * US-04-02 — PKH phân công phản biện kín.
 */
export default class ProjectOutlineReviewsController {
  private async assertPkh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.blind_review_assign')) ||
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  /** GET /api/project-outlines/pending-review — chờ phân công */
  async pendingReview({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH phân công phản biện.' })
    }

    const rows = await ProjectOutline.query()
      .where('status', 'THUYETMINH_PENDING')
      .preload('projectProposal')
      .orderBy('submitted_at', 'desc')

    return response.ok({
      success: true,
      data: rows.map((o) => ({
        ...ProjectOutlineService.serialize(o),
        field: o.field,
        submittedAt: o.submittedAt?.toISO() ?? null,
        defaultReviewerCount: DEFAULT_REVIEWER_COUNT,
        workloadWarnThreshold: WORKLOAD_WARN_THRESHOLD,
      })),
    })
  }

  /** GET /api/project-outlines/under-review — đang phản biện kín */
  async underReview({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const rows = await ProjectOutline.query()
      .where('status', 'PHANBIEN_KIN')
      .orderBy('review_assigned_at', 'desc')

    const data = []
    for (const o of rows) {
      const assignments = await ProjectOutlineReviewAssignment.query()
        .where('project_outline_id', o.id)
        .orderBy('id', 'asc')
      data.push({
        ...ProjectOutlineService.serialize(o),
        assignments: assignments.map((a) =>
          ProjectOutlineReviewService.serializeAssignment(a)
        ),
      })
    }
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outlines/:id/available-reviewers */
  async availableReviewers({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const outline = await ProjectOutline.find(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }

    const { blockedUserIds, profileIds } = await ProjectOutlineReviewService.getConflictSets(
      outline
    )
    const keyword = String(request.input('keyword') || '').trim()

    let q = ScientificProfile.query().whereNotNull('user_id')
    if (blockedUserIds.size) q = q.whereNotIn('user_id', [...blockedUserIds])
    if (profileIds.size) q = q.whereNotIn('id', [...profileIds])
    if (keyword) {
      const like = `%${keyword}%`
      q = q.where((b) => {
        b.whereILike('full_name', like)
          .orWhereILike('work_email', like)
          .orWhereILike('organization', like)
          .orWhereILike('faculty', like)
          .orWhereILike('department', like)
      })
    }

    const list = await q.limit(50)
    const data = []
    for (const p of list) {
      const workload = p.userId
        ? await ProjectOutlineReviewService.countActiveAssignmentsThisMonth(p.userId)
        : 0
      data.push({
        scientificProfileId: p.id,
        reviewerUserId: p.userId,
        reviewerName: p.fullName,
        reviewerEmail: p.workEmail,
        degree: p.degree,
        academicTitle: p.academicTitle,
        unit: p.department || p.faculty || p.organization || null,
        isExternal: false,
        activeAssignmentsThisMonth: workload,
        workloadWarning: workload >= WORKLOAD_WARN_THRESHOLD,
      })
    }
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outlines/:id/review-assignments */
  async listAssignments({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await ProjectOutline.find(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }

    const isPkh = await this.assertPkh(user.id)
    const proposal = await ProjectProposal.find(outline.projectProposalId)
    const canWrite = proposal
      ? await ProjectOutlineService.userCanWriteOutline(proposal, user.id)
      : Number(outline.ownerId) === Number(user.id)
    if (!isPkh && !canWrite) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }

    const rows = await ProjectOutlineReviewAssignment.query()
      .where('project_outline_id', outline.id)
      .orderBy('id', 'asc')

    // CNĐT chỉ thấy bản ẩn danh
    const mask = !isPkh
    return response.ok({
      success: true,
      data: rows.map((a) => ProjectOutlineReviewService.serializeAssignment(a, { maskIdentity: mask })),
    })
  }

  /** POST /api/project-outlines/:id/assign-reviewers */
  async assign({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH phân công phản biện.' })
    }
    const outline = await ProjectOutline.find(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }

    const payload = await request.validateUsing(assignOutlineReviewersValidator)
    try {
      const deadline = ProjectOutlineReviewService.resolveDeadline(
        payload.deadlineAt,
        payload.businessDays
      )
      const result = await ProjectOutlineReviewService.assignReviewers(
        outline,
        user.id,
        payload.reviewers,
        deadline,
        payload.reviewerCountTarget
      )
      const full = await ProjectOutline.query()
        .where('id', outline.id)
        .preload('members')
        .preload('budgetLines')
        .first()
      return response.ok({
        success: true,
        message: 'Đã phân công phản biện kín.',
        data: {
          outline: ProjectOutlineService.serialize(full!),
          assignments: result.assignments.map((a) =>
            ProjectOutlineReviewService.serializeAssignment(a)
          ),
          warnings: result.warnings,
        },
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Phân công thất bại.',
      })
    }
  }

  /** POST /api/project-outlines/:id/replace-reviewer */
  async replace({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH được thay phản biện.' })
    }
    const outline = await ProjectOutline.find(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    if (outline.status !== 'PHANBIEN_KIN') {
      return response.badRequest({
        success: false,
        message: 'Chỉ thay phản biện khi đang ở trạng thái Phản biện kín.',
      })
    }

    const payload = await request.validateUsing(replaceOutlineReviewerValidator)
    try {
      const deadline = ProjectOutlineReviewService.resolveDeadline(
        payload.deadlineAt,
        payload.businessDays
      )
      const result = await ProjectOutlineReviewService.replaceReviewer(
        outline,
        user.id,
        payload.assignmentId,
        payload.reason,
        payload.reviewer,
        deadline,
        payload.workloadOverrideReason
      )
      return response.ok({
        success: true,
        message: 'Đã thay phản biện.',
        data: {
          cancelled: ProjectOutlineReviewService.serializeAssignment(result.cancelled),
          created: ProjectOutlineReviewService.serializeAssignment(result.created),
        },
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Thay phản biện thất bại.',
      })
    }
  }
}
