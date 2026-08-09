import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectOutlineReviewAssignment from '#models/project_outline_review_assignment'
import ProjectProposalMember from '#models/project_proposal_member'
import ScientificProfile from '#models/scientific_profile'
import User from '#models/user'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'

/** Cảnh báo khi phản biện đã nhận > N nhiệm vụ trong tháng */
export const WORKLOAD_WARN_THRESHOLD = 3
/** Gợi ý mặc định số phản biện (TBD: 2–3) */
export const DEFAULT_REVIEWER_COUNT = 2

type ReviewerInput = {
  reviewerUserId?: number | null
  scientificProfileId?: number | null
  reviewerName: string
  reviewerEmail?: string | null
  isExternal?: boolean
  expertiseExceptionReason?: string | null
  workloadOverrideReason?: string | null
}

export default class ProjectOutlineReviewService {
  static serializeAssignment(a: ProjectOutlineReviewAssignment, opts?: { maskIdentity?: boolean }) {
    if (opts?.maskIdentity) {
      return {
        id: a.id,
        status: a.status,
        deadlineAt: a.deadlineAt?.toISO() ?? null,
        isExternal: a.isExternal,
        // Ẩn danh tính với CNĐT / thành viên đề tài
        reviewerName: 'Phản biện kín',
        reviewerEmail: null,
        reviewerUserId: null,
        scientificProfileId: null,
      }
    }
    return {
      id: a.id,
      projectOutlineId: a.projectOutlineId,
      reviewerUserId: a.reviewerUserId,
      scientificProfileId: a.scientificProfileId,
      reviewerName: a.reviewerName,
      reviewerEmail: a.reviewerEmail,
      isExternal: a.isExternal,
      status: a.status,
      deadlineAt: a.deadlineAt?.toISO() ?? null,
      assignedBy: a.assignedBy,
      assignedAt: a.assignedAt?.toISO() ?? null,
      expertiseExceptionReason: a.expertiseExceptionReason,
      workloadOverrideReason: a.workloadOverrideReason,
      cancelReason: a.cancelReason,
      cancelledAt: a.cancelledAt?.toISO() ?? null,
      replacedByAssignmentId: a.replacedByAssignmentId,
    }
  }

  static resolveDeadline(deadlineAt?: string | null, businessDays?: number | null): DateTime {
    if (deadlineAt) {
      const d = DateTime.fromISO(deadlineAt)
      if (d.isValid) return d.endOf('day')
    }
    const days = businessDays && businessDays > 0 ? businessDays : 10
    return DateTime.now().plus({ days }).endOf('day')
  }

  /** Id hồ sơ / user bị cấm (CNĐT + thành viên đề tài) */
  static async getConflictSets(outline: ProjectOutline) {
    const members = await ProjectOutlineMember.query().where('project_outline_id', outline.id)
    const profileIds = new Set(
      members.map((m) => m.profileId).filter((id): id is number => id != null)
    )
    const proposalMembers = await ProjectProposalMember.query().where(
      'project_proposal_id',
      outline.projectProposalId
    )
    for (const m of proposalMembers) {
      if (m.profileId) profileIds.add(m.profileId)
    }

    const blockedUserIds = new Set<number>([Number(outline.ownerId)])
    if (profileIds.size) {
      const profiles = await ScientificProfile.query().whereIn('id', [...profileIds])
      for (const p of profiles) {
        if (p.userId) blockedUserIds.add(Number(p.userId))
      }
    }
    return { profileIds, blockedUserIds }
  }

  static async countActiveAssignmentsThisMonth(reviewerUserId: number): Promise<number> {
    const start = DateTime.now().startOf('month').toSQL()
    const end = DateTime.now().endOf('month').toSQL()
    const rows = await ProjectOutlineReviewAssignment.query()
      .where('reviewer_user_id', reviewerUserId)
      .whereIn('status', ['INVITED', 'ACTIVE'])
      .where('assigned_at', '>=', start!)
      .where('assigned_at', '<=', end!)
      .select('id')
    return rows.length
  }

  static async hasActiveReviewProcess(outlineId: number): Promise<boolean> {
    const rows = await ProjectOutlineReviewAssignment.query()
      .where('project_outline_id', outlineId)
      .whereIn('status', ['INVITED', 'ACTIVE'])
      .select('id')
      .limit(1)
    return rows.length > 0
  }

  static async validateReviewerCandidate(
    outline: ProjectOutline,
    r: ReviewerInput
  ): Promise<{ error?: string; workloadWarning?: string }> {
    const { profileIds, blockedUserIds } = await this.getConflictSets(outline)

    let userId = r.reviewerUserId ?? null
    let profileId = r.scientificProfileId ?? null

    if (profileId) {
      const profile = await ScientificProfile.find(profileId)
      if (!profile) return { error: `Không tìm thấy hồ sơ #${profileId}.` }
      userId = userId ?? profile.userId
      if (profileIds.has(profile.id)) {
        return { error: `"${r.reviewerName}" là thành viên đề tài — không được phân công phản biện.` }
      }
    }
    if (userId && blockedUserIds.has(Number(userId))) {
      return {
        error: `"${r.reviewerName}" là chủ nhiệm/thành viên đề tài — không được phân công phản biện.`,
      }
    }

    let workloadWarning: string | undefined
    if (userId) {
      const cnt = await this.countActiveAssignmentsThisMonth(Number(userId))
      if (cnt >= WORKLOAD_WARN_THRESHOLD) {
        workloadWarning = `"${r.reviewerName}" đã nhận ${cnt} nhiệm vụ phản biện trong tháng này (ngưỡng cảnh báo ${WORKLOAD_WARN_THRESHOLD}).`
        if (!r.workloadOverrideReason?.trim()) {
          return {
            error: `${workloadWarning} Cần nhập lý do tiếp tục phân công (workloadOverrideReason).`,
            workloadWarning,
          }
        }
      }
    }

    return { workloadWarning }
  }

  static async assignReviewers(
    outline: ProjectOutline,
    actorId: number,
    reviewers: ReviewerInput[],
    deadline: DateTime,
    reviewerCountTarget?: number
  ) {
    if (outline.status !== 'THUYETMINH_PENDING') {
      throw new Error('Chỉ phân công khi thuyết minh đang chờ PKH (THUYETMINH_PENDING).')
    }
    if (await this.hasActiveReviewProcess(outline.id)) {
      throw new Error('Đã có quy trình phản biện đang hoạt động cho thuyết minh này.')
    }
    if (reviewers.length < 1) throw new Error('Cần ít nhất một phản biện.')

    const warnings: string[] = []
    const created: ProjectOutlineReviewAssignment[] = []

    for (const r of reviewers) {
      const check = await this.validateReviewerCandidate(outline, r)
      if (check.error) throw new Error(check.error)
      if (check.workloadWarning) warnings.push(check.workloadWarning)

      let userId = r.reviewerUserId ?? null
      let profileId = r.scientificProfileId ?? null
      let email = r.reviewerEmail?.trim() || null
      let name = r.reviewerName.trim()
      const isExternal = !!r.isExternal || !userId

      if (profileId) {
        const profile = await ScientificProfile.find(profileId)
        if (profile) {
          userId = userId ?? profile.userId
          email = email || profile.workEmail || null
          if (!name) name = profile.fullName
        }
      }
      if (userId && !email) {
        const u = await User.find(userId)
        email = u?.email || null
      }

      const row = await ProjectOutlineReviewAssignment.create({
        projectOutlineId: outline.id,
        reviewerUserId: userId,
        scientificProfileId: profileId,
        reviewerName: name,
        reviewerEmail: email,
        isExternal,
        status: 'INVITED',
        deadlineAt: deadline,
        assignedBy: actorId,
        assignedAt: DateTime.now(),
        expertiseExceptionReason: r.expertiseExceptionReason?.trim() || null,
        workloadOverrideReason: r.workloadOverrideReason?.trim() || null,
      })
      created.push(row)

      if (userId) {
        await NotificationService.push(userId, {
          type: 'PROJECT_UPDATE',
          title: 'Mời phản biện kín thuyết minh',
          message: `Bạn được phân công phản biện kín cho thuyết minh "${outline.title}" (${outline.code}). Hạn: ${deadline.toFormat('dd/MM/yyyy')}.`,
          link: `/projects/blind-reviews/tasks/${row.id}`,
        })
        await EmailLogService.logStubToUser(
          userId,
          `[KH&CN] Mời phản biện kín — ${outline.code}`,
          [
            'Kính gửi Quý thầy/cô,',
            '',
            'Phòng Khoa học trân trọng mời Quý thầy/cô tham gia phản biện kín thuyết minh đề tài:',
            `- Mã: ${outline.code}`,
            `- Tên: ${outline.title}`,
            `- Hạn hoàn thành: ${deadline.toFormat('dd/MM/yyyy HH:mm')}`,
            '',
            'Danh tính phản biện được bảo mật đối với chủ nhiệm và thành viên đề tài trong suốt quá trình đánh giá.',
            'Vui lòng đăng nhập hệ thống để thực hiện nhiệm vụ.',
            '',
            'Trân trọng.',
            'Hệ thống Quản lý đề tài Khoa học và Công nghệ',
          ].join('\n'),
          'project_outline_review_assignment',
          row.id
        )
      } else if (email) {
        await EmailLogService.logStub({
          toEmail: email,
          subject: `[KH&CN] Mời phản biện kín (chuyên gia ngoài) — ${outline.code}`,
          body: [
            `Kính gửi ${name},`,
            '',
            'Phòng Khoa học mời Quý vị phản biện kín thuyết minh:',
            `${outline.code} — ${outline.title}`,
            `Hạn: ${deadline.toFormat('dd/MM/yyyy')}`,
            '',
            'Vui lòng liên hệ PKH để kích hoạt tài khoản truy cập hệ thống (nếu chưa có).',
          ].join('\n'),
          relatedType: 'project_outline_review_assignment',
          relatedId: row.id,
        })
      }
    }

    const from = outline.status
    outline.status = 'PHANBIEN_KIN'
    outline.reviewAssignedAt = DateTime.now()
    outline.reviewAssignedBy = actorId
    outline.reviewerCountTarget = reviewerCountTarget ?? reviewers.length
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'ASSIGN_BLIND_REVIEW',
      from,
      'PHANBIEN_KIN',
      {
        assignmentIds: created.map((c) => c.id),
        deadline: deadline.toISO(),
        warnings,
      }
    )

    return { assignments: created, warnings }
  }

  static async replaceReviewer(
    outline: ProjectOutline,
    actorId: number,
    assignmentId: number,
    reason: string,
    reviewer: ReviewerInput,
    deadline: DateTime,
    workloadOverrideReason?: string | null
  ) {
    const old = await ProjectOutlineReviewAssignment.query()
      .where('id', assignmentId)
      .where('project_outline_id', outline.id)
      .first()
    if (!old) throw new Error('Không tìm thấy phân công.')
    if (old.status === 'CANCELLED') throw new Error('Phân công đã hủy.')
    if (old.status === 'COMPLETED') {
      throw new Error('Phản biện đã nộp phiếu — không thay âm thầm; cần quy trình mở/hủy kết quả.')
    }

    const input = {
      ...reviewer,
      workloadOverrideReason: workloadOverrideReason ?? reviewer.workloadOverrideReason,
    }
    const check = await this.validateReviewerCandidate(outline, input)
    if (check.error) throw new Error(check.error)

    old.status = 'CANCELLED'
    old.cancelReason = reason.trim()
    old.cancelledBy = actorId
    old.cancelledAt = DateTime.now()
    await old.save()

    let userId = reviewer.reviewerUserId ?? null
    let profileId = reviewer.scientificProfileId ?? null
    let email = reviewer.reviewerEmail?.trim() || null
    let name = reviewer.reviewerName.trim()
    if (profileId) {
      const profile = await ScientificProfile.find(profileId)
      if (profile) {
        userId = userId ?? profile.userId
        email = email || profile.workEmail || null
        name = name || profile.fullName
      }
    }

    const neu = await ProjectOutlineReviewAssignment.create({
      projectOutlineId: outline.id,
      reviewerUserId: userId,
      scientificProfileId: profileId,
      reviewerName: name,
      reviewerEmail: email,
      isExternal: !!reviewer.isExternal || !userId,
      status: 'INVITED',
      deadlineAt: deadline,
      assignedBy: actorId,
      assignedAt: DateTime.now(),
      expertiseExceptionReason: reviewer.expertiseExceptionReason?.trim() || null,
      workloadOverrideReason: input.workloadOverrideReason?.trim() || null,
    })
    old.replacedByAssignmentId = neu.id
    await old.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'REPLACE_BLIND_REVIEWER',
      outline.status,
      outline.status,
      { oldAssignmentId: old.id, newAssignmentId: neu.id, reason }
    )

    if (userId) {
      await NotificationService.push(userId, {
        type: 'PROJECT_UPDATE',
        title: 'Mời phản biện kín thuyết minh (thay thế)',
        message: `Bạn được phân công phản biện kín cho "${outline.title}" (${outline.code}).`,
        link: `/projects/blind-reviews/tasks/${neu.id}`,
      })
    }

    return { cancelled: old, created: neu }
  }
}
