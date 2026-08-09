import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineReviewAssignment from '#models/project_outline_review_assignment'
import ProjectOutlineReviewScoreSheet from '#models/project_outline_review_score_sheet'
import PermissionService from '#services/permission_service'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectOutlineReviewService from '#services/project_outline_review_service'
import ProjectOutlineScoreService from '#services/project_outline_score_service'
import NotificationService from '#services/notification_service'
import {
  saveReviewScoreDraftValidator,
  submitReviewScoreValidator,
  reopenReviewScoreValidator,
  extendReviewDeadlineValidator,
} from '#validators/project_outline_score_validator'

/**
 * US-04-03 — Phản biện chấm điểm theo tiêu chí.
 */
export default class ProjectOutlineScoresController {
  private async assertPkh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.blind_review_assign')) ||
      (await PermissionService.userHasPermission(userId, 'project.defense_manage')) ||
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  /** GET /api/project-outline-review-tasks — nhiệm vụ của tôi */
  async myTasks({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const rows = await ProjectOutlineReviewAssignment.query()
      .where('reviewer_user_id', user.id)
      .whereIn('status', ['INVITED', 'ACTIVE', 'COMPLETED'])
      .orderBy('deadline_at', 'asc')

    const data = []
    for (const a of rows) {
      const outline = await ProjectOutline.find(a.projectOutlineId)
      const sheet = await ProjectOutlineReviewScoreSheet.query()
        .where('assignment_id', a.id)
        .first()
      data.push({
        assignment: ProjectOutlineReviewService.serializeAssignment(a),
        outline: outline
          ? {
              id: outline.id,
              code: outline.code,
              title: outline.title,
              status: outline.status,
              ownerName: outline.ownerName,
              ownerUnit: outline.ownerUnit,
              field: outline.field,
            }
          : null,
        scoreSheetStatus: sheet?.status ?? null,
        totalScore: sheet?.status === 'SUBMITTED' ? sheet.totalScore : null,
        pastDeadline: a.deadlineAt < DateTime.now(),
      })
    }
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outline-review-tasks/:assignmentId */
  async showTask({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const assignment = await ProjectOutlineReviewAssignment.find(Number(params.assignmentId))
    if (!assignment) {
      return response.notFound({ success: false, message: 'Không tìm thấy nhiệm vụ.' })
    }
    const isPkh = await this.assertPkh(user.id)
    const isOwner = Number(assignment.reviewerUserId) === Number(user.id)
    if (!isOwner && !isPkh) {
      return response.forbidden({ success: false, message: 'Không có quyền xem nhiệm vụ này.' })
    }

    try {
      let sheet
      let outline
      let pastDeadline = assignment.deadlineAt < DateTime.now()
      if (isOwner) {
        const opened = await ProjectOutlineScoreService.getOrCreateSheet(assignment, user.id)
        sheet = opened.sheet
        outline = opened.outline
        pastDeadline = opened.pastDeadline
      } else {
        outline = await ProjectOutline.findOrFail(assignment.projectOutlineId)
        sheet = await ProjectOutlineReviewScoreSheet.query()
          .where('assignment_id', assignment.id)
          .preload('lines')
          .first()
      }

      const fullOutline = await ProjectOutline.query()
        .where('id', outline!.id)
        .preload('members')
        .preload('budgetLines')
        .first()

      // PKH: ẩn điểm từng phiếu nếu blind và chưa đủ
      let hideScores = false
      if (isPkh && sheet) {
        const snap = sheet.criteriaSnapshot
        if (snap?.blindAggregation && !fullOutline?.reviewScoresCompletedAt) {
          hideScores = true
        }
      }

      return response.ok({
        success: true,
        data: {
          assignment: ProjectOutlineReviewService.serializeAssignment(assignment),
          outline: ProjectOutlineService.serialize(fullOutline!),
          scoreSheet: sheet
            ? ProjectOutlineScoreService.serializeSheet(sheet, undefined, { hideScores })
            : null,
          pastDeadline,
          isReviewer: isOwner,
          isPkh,
        },
      })
    } catch (e: any) {
      return response.badRequest({ success: false, message: e?.message || 'Lỗi tải nhiệm vụ.' })
    }
  }

  /** PUT /api/project-outline-review-tasks/:assignmentId/score-draft */
  async saveDraft({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const assignment = await ProjectOutlineReviewAssignment.find(Number(params.assignmentId))
    if (!assignment || Number(assignment.reviewerUserId) !== Number(user.id)) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const payload = await request.validateUsing(saveReviewScoreDraftValidator)
    try {
      const { sheet } = await ProjectOutlineScoreService.getOrCreateSheet(assignment, user.id)
      const saved = await ProjectOutlineScoreService.saveDraft(sheet, assignment, payload)
      return response.ok({
        success: true,
        message: 'Đã lưu nháp phiếu chấm.',
        data: ProjectOutlineScoreService.serializeSheet(saved),
      })
    } catch (e: any) {
      return response.unprocessableEntity({ success: false, message: e?.message || 'Lưu thất bại.' })
    }
  }

  /** POST /api/project-outline-review-tasks/:assignmentId/score-submit */
  async submit({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const assignment = await ProjectOutlineReviewAssignment.find(Number(params.assignmentId))
    if (!assignment || Number(assignment.reviewerUserId) !== Number(user.id)) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const payload = await request.validateUsing(submitReviewScoreValidator)
    try {
      const { sheet } = await ProjectOutlineScoreService.getOrCreateSheet(assignment, user.id)
      // Idempotent: đã nộp → trả về phiếu hiện tại
      if (sheet.status === 'SUBMITTED') {
        await sheet.load('lines')
        return response.ok({
          success: true,
          message: 'Phiếu đã được nộp trước đó.',
          data: ProjectOutlineScoreService.serializeSheet(sheet),
        })
      }
      const saved = await ProjectOutlineScoreService.submit(sheet, assignment, user.id, payload)
      return response.ok({
        success: true,
        message: 'Đã nộp phiếu chấm — phiếu đã khóa.',
        data: ProjectOutlineScoreService.serializeSheet(saved),
      })
    } catch (e: any) {
      return response.unprocessableEntity({ success: false, message: e?.message || 'Nộp thất bại.' })
    }
  }

  /** POST /api/project-outline-review-tasks/:assignmentId/score-reopen — PKH */
  async reopen({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH mở lại phiếu.' })
    }
    const assignment = await ProjectOutlineReviewAssignment.find(Number(params.assignmentId))
    if (!assignment) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const sheet = await ProjectOutlineReviewScoreSheet.query()
      .where('assignment_id', assignment.id)
      .first()
    if (!sheet) {
      return response.badRequest({ success: false, message: 'Chưa có phiếu chấm.' })
    }
    const payload = await request.validateUsing(reopenReviewScoreValidator)
    try {
      const saved = await ProjectOutlineScoreService.reopen(
        sheet,
        assignment,
        user.id,
        payload.reason
      )
      await saved.load('lines')
      return response.ok({
        success: true,
        message: 'Đã mở lại phiếu.',
        data: ProjectOutlineScoreService.serializeSheet(saved),
      })
    } catch (e: any) {
      return response.unprocessableEntity({ success: false, message: e?.message || 'Thất bại.' })
    }
  }

  /** POST /api/project-outline-review-tasks/:assignmentId/extend-deadline — PKH */
  async extendDeadline({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH gia hạn.' })
    }
    const assignment = await ProjectOutlineReviewAssignment.find(Number(params.assignmentId))
    if (!assignment) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(extendReviewDeadlineValidator)
    const d = DateTime.fromISO(payload.deadlineAt)
    if (!d.isValid) {
      return response.badRequest({ success: false, message: 'deadlineAt không hợp lệ.' })
    }
    assignment.deadlineAt = d.endOf('day')
    await assignment.save()
    await ProjectOutlineService.writeAudit(
      assignment.projectOutlineId,
      user.id,
      'EXTEND_REVIEW_DEADLINE',
      null,
      null,
      { assignmentId: assignment.id, deadlineAt: d.toISO(), reason: payload.reason }
    )
    if (assignment.reviewerUserId) {
      await NotificationService.push(assignment.reviewerUserId, {
        type: 'PROJECT_UPDATE',
        title: 'Gia hạn deadline phản biện',
        message: `Hạn mới: ${d.toFormat('dd/MM/yyyy')}`,
        link: `/projects/blind-reviews/tasks/${assignment.id}`,
      })
    }
    return response.ok({
      success: true,
      message: 'Đã gia hạn deadline.',
      data: ProjectOutlineReviewService.serializeAssignment(assignment),
    })
  }

  /** GET /api/project-outlines/:id/review-score-summary — PKH tổng hợp */
  async summary({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const outline = await ProjectOutline.find(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const assignments = await ProjectOutlineReviewAssignment.query()
      .where('project_outline_id', outline.id)
      .orderBy('id', 'asc')
    const sheets = await ProjectOutlineReviewScoreSheet.query()
      .where('project_outline_id', outline.id)
      .preload('lines')

    const completed = !!outline.reviewScoresCompletedAt
    const blind = sheets[0]?.criteriaSnapshot?.blindAggregation !== false
    const hide = blind && !completed

    return response.ok({
      success: true,
      data: {
        outlineId: outline.id,
        code: outline.code,
        averageScore: outline.reviewAverageScore,
        belowThreshold: outline.reviewBelowThreshold,
        completedAt: outline.reviewScoresCompletedAt?.toISO() ?? null,
        blindAggregation: blind,
        assignments: assignments.map((a) => {
          const sh = sheets.find((s) => s.assignmentId === a.id)
          return {
            assignment: ProjectOutlineReviewService.serializeAssignment(a),
            scoreSheet: sh
              ? ProjectOutlineScoreService.serializeSheet(sh, undefined, { hideScores: hide })
              : null,
          }
        }),
      },
    })
  }
}
