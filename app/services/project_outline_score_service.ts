import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineReviewAssignment from '#models/project_outline_review_assignment'
import ProjectOutlineReviewScoreSheet from '#models/project_outline_review_score_sheet'
import type { CriteriaSnapshot } from '#models/project_outline_review_score_sheet'
import ProjectOutlineReviewScoreLine from '#models/project_outline_review_score_line'
import ProjectReviewCriteriaSet from '#models/project_review_criteria_set'
import NotificationService from '#services/notification_service'
import ProjectOutlineService from '#services/project_outline_service'

type LineInput = { criterionCode: string; score?: number | null; comment?: string | null }

export default class ProjectOutlineScoreService {
  static async getDefaultCriteriaSet() {
    let set = await ProjectReviewCriteriaSet.query()
      .where('is_default', true)
      .where('is_active', true)
      .preload('items', (q) => q.orderBy('sort_order', 'asc'))
      .first()
    if (!set) {
      set = await ProjectReviewCriteriaSet.query()
        .where('is_active', true)
        .preload('items', (q) => q.orderBy('sort_order', 'asc'))
        .first()
    }
    return set
  }

  static buildSnapshot(set: ProjectReviewCriteriaSet): CriteriaSnapshot {
    return {
      setId: set.id,
      setCode: set.code,
      setName: set.name,
      failThreshold: Number(set.failThreshold),
      blindAggregation: !!set.blindAggregation,
      minCommentLength: Number(set.minCommentLength || 0),
      items: (set.items || []).map((it) => ({
        code: it.code,
        name: it.name,
        description: it.description,
        maxScore: Number(it.maxScore),
        weight: Number(it.weight),
        sortOrder: it.sortOrder,
        commentRequired: !!it.commentRequired,
      })),
    }
  }

  static calcTotal(lines: Array<{ score: number | null; weight: number; maxScore: number }>) {
    let sum = 0
    for (const l of lines) {
      if (l.score == null) continue
      // weighted_score = score * weight (mặc định weight=1 → tổng điểm tuyệt đối)
      sum += Number(l.score) * Number(l.weight || 1)
    }
    return Math.round(sum * 100) / 100
  }

  static serializeSheet(
    sheet: ProjectOutlineReviewScoreSheet,
    lines?: ProjectOutlineReviewScoreLine[],
    opts?: { hideScores?: boolean }
  ) {
    const ls = lines ?? sheet.lines ?? []
    return {
      id: sheet.id,
      assignmentId: sheet.assignmentId,
      projectOutlineId: sheet.projectOutlineId,
      status: sheet.status,
      totalScore: opts?.hideScores ? null : sheet.totalScore,
      generalComment: opts?.hideScores ? null : sheet.generalComment,
      conclusion: opts?.hideScores ? null : sheet.conclusion,
      submittedAt: sheet.submittedAt?.toISO() ?? null,
      reopenedAt: sheet.reopenedAt?.toISO() ?? null,
      reopenReason: sheet.reopenReason,
      criteriaSnapshot: sheet.criteriaSnapshot,
      editable: sheet.status === 'DRAFT',
      lines: ls
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l) => ({
          id: l.id,
          criterionCode: l.criterionCode,
          criterionName: l.criterionName,
          maxScore: Number(l.maxScore),
          weight: Number(l.weight),
          sortOrder: l.sortOrder,
          commentRequired: l.commentRequired,
          score: opts?.hideScores ? null : l.score == null ? null : Number(l.score),
          comment: opts?.hideScores ? null : l.comment,
        })),
    }
  }

  /** Mở / lấy phiếu; tạo snapshot lần đầu. COMPLETED chỉ xem phiếu đã có. */
  static async getOrCreateSheet(assignment: ProjectOutlineReviewAssignment, actorUserId: number) {
    if (!['INVITED', 'ACTIVE', 'COMPLETED'].includes(assignment.status)) {
      throw new Error('Assignment không còn hiệu lực để chấm điểm.')
    }
    if (assignment.reviewerUserId && Number(assignment.reviewerUserId) !== Number(actorUserId)) {
      throw new Error('Không phải phản biện được phân công.')
    }
    if (!assignment.reviewerUserId) {
      throw new Error('Phản biện ngoài chưa kích hoạt tài khoản — chưa thể chấm trên hệ thống.')
    }

    const outline = await ProjectOutline.find(assignment.projectOutlineId)
    if (!outline || outline.status !== 'PHANBIEN_KIN') {
      throw new Error('Thuyết minh không ở trạng thái phản biện kín.')
    }

    let sheet = await ProjectOutlineReviewScoreSheet.query()
      .where('assignment_id', assignment.id)
      .preload('lines')
      .first()

    if (!sheet && assignment.status === 'COMPLETED') {
      throw new Error('Không tìm thấy phiếu chấm đã nộp.')
    }

    if (!sheet) {
      const set = await this.getDefaultCriteriaSet()
      if (!set || !(set.items || []).length) {
        throw new Error('Chưa cấu hình bộ tiêu chí phản biện. Liên hệ ADMIN.')
      }
      const snapshot = this.buildSnapshot(set)
      sheet = await ProjectOutlineReviewScoreSheet.create({
        assignmentId: assignment.id,
        projectOutlineId: outline.id,
        criteriaSetId: set.id,
        criteriaSnapshot: snapshot,
        status: 'DRAFT',
        totalScore: null,
        generalComment: null,
        conclusion: null,
      })
      for (const it of snapshot.items) {
        await ProjectOutlineReviewScoreLine.create({
          scoreSheetId: sheet.id,
          criterionCode: it.code,
          criterionName: it.name,
          maxScore: it.maxScore,
          weight: it.weight,
          sortOrder: it.sortOrder,
          commentRequired: it.commentRequired,
          score: null,
          comment: null,
        })
      }
      await sheet.load('lines')
    }

    if (assignment.status === 'INVITED') {
      assignment.status = 'ACTIVE'
      await assignment.save()
    }

    return { sheet, outline, pastDeadline: assignment.deadlineAt < DateTime.now() }
  }

  static async applyLines(sheet: ProjectOutlineReviewScoreSheet, lines: LineInput[]) {
    const byCode = new Map(lines.map((l) => [l.criterionCode, l]))
    const dbLines = await ProjectOutlineReviewScoreLine.query().where('score_sheet_id', sheet.id)
    for (const row of dbLines) {
      const input = byCode.get(row.criterionCode)
      if (!input) continue
      if (input.score != null) {
        const s = Number(input.score)
        if (s < 0 || s > Number(row.maxScore)) {
          throw new Error(
            `Điểm "${row.criterionName}" phải từ 0 đến ${row.maxScore} (nhận ${s}).`
          )
        }
        row.score = s
      } else {
        row.score = null
      }
      if (input.comment !== undefined) row.comment = input.comment?.trim() || null
      await row.save()
    }
    const refreshed = await ProjectOutlineReviewScoreLine.query().where('score_sheet_id', sheet.id)
    sheet.totalScore = this.calcTotal(refreshed)
    await sheet.save()
    return refreshed
  }

  static validateForSubmit(
    sheet: ProjectOutlineReviewScoreSheet,
    lines: ProjectOutlineReviewScoreLine[]
  ): string[] {
    const snap = sheet.criteriaSnapshot
    const minLen = Number(snap?.minCommentLength ?? 50)
    const errors: string[] = []
    for (const l of lines) {
      if (l.score == null) errors.push(`Thiếu điểm: ${l.criterionName}`)
      else if (Number(l.score) < 0 || Number(l.score) > Number(l.maxScore)) {
        errors.push(`Điểm ngoài khoảng: ${l.criterionName}`)
      }
      if (l.commentRequired) {
        const c = (l.comment || '').trim()
        if (c.length < minLen) {
          errors.push(
            `Nhận xét "${l.criterionName}" cần ≥ ${minLen} ký tự (hiện ${c.length}).`
          )
        }
      }
    }
    return errors
  }

  static async saveDraft(
    sheet: ProjectOutlineReviewScoreSheet,
    assignment: ProjectOutlineReviewAssignment,
    payload: {
      generalComment?: string | null
      conclusion?: string | null
      lines?: LineInput[]
    }
  ) {
    if (sheet.status !== 'DRAFT') throw new Error('Phiếu đã nộp — không lưu nháp.')
    if (assignment.deadlineAt < DateTime.now()) {
      throw new Error('Đã quá deadline — không lưu được (liên hệ PKH gia hạn).')
    }
    if (payload.lines) await this.applyLines(sheet, payload.lines)
    if (payload.generalComment !== undefined) {
      sheet.generalComment = payload.generalComment?.trim() || null
    }
    if (payload.conclusion !== undefined) sheet.conclusion = payload.conclusion
    await sheet.save()
    await sheet.load('lines')
    return sheet
  }

  static async submit(
    sheet: ProjectOutlineReviewScoreSheet,
    assignment: ProjectOutlineReviewAssignment,
    actorId: number,
    payload: {
      generalComment?: string | null
      conclusion?: string | null
      lines: LineInput[]
    }
  ) {
    if (sheet.status === 'SUBMITTED') {
      throw new Error('Phiếu đã nộp và khóa.')
    }
    if (assignment.deadlineAt < DateTime.now()) {
      throw new Error('Đã quá deadline — không nộp được (liên hệ PKH gia hạn).')
    }

    const lines = await this.applyLines(sheet, payload.lines)
    if (payload.generalComment !== undefined) {
      sheet.generalComment = payload.generalComment?.trim() || null
    }
    if (payload.conclusion !== undefined) sheet.conclusion = payload.conclusion

    const errors = this.validateForSubmit(sheet, lines)
    if (errors.length) throw new Error(errors[0])

    sheet.status = 'SUBMITTED'
    sheet.submittedAt = DateTime.now()
    sheet.totalScore = this.calcTotal(lines)
    await sheet.save()

    assignment.status = 'COMPLETED'
    await assignment.save()

    await ProjectOutlineService.writeAudit(
      assignment.projectOutlineId,
      actorId,
      'SUBMIT_REVIEW_SCORE',
      'PHANBIEN_KIN',
      'PHANBIEN_KIN',
      { assignmentId: assignment.id, sheetId: sheet.id, totalScore: sheet.totalScore }
    )

    await this.tryAggregateAndNotify(assignment.projectOutlineId)
    await sheet.load('lines')
    return sheet
  }

  /** Khi đủ phiếu hợp lệ → average + thông báo PKH một lần */
  static async tryAggregateAndNotify(outlineId: number) {
    const outline = await ProjectOutline.find(outlineId)
    if (!outline || outline.status !== 'PHANBIEN_KIN') return

    const activeAssignments = await ProjectOutlineReviewAssignment.query()
      .where('project_outline_id', outlineId)
      .whereIn('status', ['INVITED', 'ACTIVE', 'COMPLETED'])

    const needed = activeAssignments.filter((a) => a.status !== 'CANCELLED')
    if (!needed.length) return

    const sheets = await ProjectOutlineReviewScoreSheet.query()
      .where('project_outline_id', outlineId)
      .whereIn(
        'assignment_id',
        needed.map((a) => a.id)
      )
      .where('status', 'SUBMITTED')

    if (sheets.length < needed.length) return
    if (outline.reviewScoresCompletedAt) return // đã thông báo

    const sum = sheets.reduce((s, sh) => s + Number(sh.totalScore || 0), 0)
    const avg = Math.round((sum / sheets.length) * 100) / 100
    const snap = sheets[0]?.criteriaSnapshot
    const threshold = Number(snap?.failThreshold ?? 50)

    outline.reviewAverageScore = avg
    outline.reviewBelowThreshold = avg < threshold
    outline.reviewScoresCompletedAt = DateTime.now()
    await outline.save()

    await NotificationService.pushToPermission('project.review', {
      type: 'PROJECT_UPDATE',
      title: 'Đủ phiếu phản biện kín',
      message: `Thuyết minh ${outline.code} đã đủ phiếu. Điểm TB: ${avg}${
        avg < threshold ? ' (dưới ngưỡng — đánh dấu không đạt theo điểm)' : ''
      }.`,
      link: `/projects/blind-reviews`,
    })

    await ProjectOutlineService.writeAudit(
      outline.id,
      null,
      'REVIEW_SCORES_COMPLETE',
      'PHANBIEN_KIN',
      'PHANBIEN_KIN',
      { average: avg, threshold, below: avg < threshold }
    )
  }

  static async reopen(
    sheet: ProjectOutlineReviewScoreSheet,
    assignment: ProjectOutlineReviewAssignment,
    actorId: number,
    reason: string
  ) {
    if (sheet.status !== 'SUBMITTED') throw new Error('Chỉ mở lại phiếu đã nộp.')
    sheet.status = 'DRAFT'
    sheet.submittedAt = null
    sheet.reopenedAt = DateTime.now()
    sheet.reopenedBy = actorId
    sheet.reopenReason = reason.trim()
    await sheet.save()

    if (assignment.status === 'COMPLETED') {
      assignment.status = 'ACTIVE'
      await assignment.save()
    }

    const outline = await ProjectOutline.find(assignment.projectOutlineId)
    if (outline) {
      outline.reviewAverageScore = null
      outline.reviewBelowThreshold = null
      outline.reviewScoresCompletedAt = null
      await outline.save()
    }

    await ProjectOutlineService.writeAudit(
      assignment.projectOutlineId,
      actorId,
      'REOPEN_REVIEW_SCORE',
      'PHANBIEN_KIN',
      'PHANBIEN_KIN',
      { sheetId: sheet.id, reason }
    )

    if (assignment.reviewerUserId) {
      await NotificationService.push(assignment.reviewerUserId, {
        type: 'PROJECT_UPDATE',
        title: 'PKH mở lại phiếu phản biện',
        message: `Phiếu chấm thuyết minh đã được mở lại để chỉnh sửa. Lý do: ${reason}`,
        link: `/projects/blind-reviews/tasks/${assignment.id}`,
      })
    }
    return sheet
  }
}
