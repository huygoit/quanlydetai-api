import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectOutlineReviewAssignment from '#models/project_outline_review_assignment'
import ProjectOutlineReviewScoreSheet from '#models/project_outline_review_score_sheet'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import type {
  DefenseConclusion,
  DefenseMeetingMode,
} from '#models/project_outline_defense_session'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import type { DefenseCouncilRole } from '#models/project_outline_defense_member'
import ScientificProfile from '#models/scientific_profile'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'
import { hasAtLeastBusinessDays } from '#utils/business_days'
import { generateDefenseMinutesHtml } from '#utils/defense_minutes'

/** TBD nghiệp vụ — mặc định tối thiểu 1 người ngoài trường */
const MIN_EXTERNAL_MEMBERS = 1

type MemberInput = {
  userId?: number | null
  scientificProfileId?: number | null
  memberName: string
  memberEmail?: string | null
  roleInCouncil: DefenseCouncilRole
  isExternal?: boolean
  unit?: string | null
  proposedSourceNote?: string | null
}

export default class ProjectOutlineDefenseService {
  static serializeMember(m: ProjectOutlineDefenseMember) {
    return {
      id: m.id,
      sessionId: m.sessionId,
      userId: m.userId,
      scientificProfileId: m.scientificProfileId,
      memberName: m.memberName,
      memberEmail: m.memberEmail,
      roleInCouncil: m.roleInCouncil,
      isExternal: m.isExternal,
      unit: m.unit,
      proposedSourceNote: m.proposedSourceNote,
      attendance: m.attendance,
    }
  }

  static serializeSession(
    s: ProjectOutlineDefenseSession,
    members?: ProjectOutlineDefenseMember[],
    outline?: ProjectOutline | null
  ) {
    const ms = members ?? s.members ?? []
    return {
      id: s.id,
      projectOutlineId: s.projectOutlineId,
      status: s.status,
      meetingMode: s.meetingMode,
      meetingAt: s.meetingAt?.toISO() ?? null,
      location: s.location,
      meetingUrl: s.meetingUrl,
      shortNoticeOverride: s.shortNoticeOverride,
      shortNoticeReason: s.shortNoticeReason,
      cancelledAt: s.cancelledAt?.toISO() ?? null,
      cancelReason: s.cancelReason,
      discussionNotes: s.discussionNotes,
      conclusion: s.conclusion,
      finalScore: s.finalScore == null ? null : Number(s.finalScore),
      adjustmentRequirements: s.adjustmentRequirements,
      adjustmentDeadline: s.adjustmentDeadline?.toISO() ?? null,
      minutesHtml: s.minutesHtml,
      minutesFileUrl: s.minutesFileUrl,
      finalizedAt: s.finalizedAt?.toISO() ?? null,
      finalizedBy: s.finalizedBy,
      createdBy: s.createdBy,
      version: s.version,
      createdAt: s.createdAt?.toISO() ?? null,
      updatedAt: s.updatedAt?.toISO() ?? null,
      members: ms.map((m) => this.serializeMember(m)),
      outline: outline
        ? {
            id: outline.id,
            code: outline.code,
            title: outline.title,
            status: outline.status,
            ownerName: outline.ownerName,
            ownerUnit: outline.ownerUnit,
            field: outline.field,
            reviewAverageScore:
              outline.reviewAverageScore == null ? null : Number(outline.reviewAverageScore),
            reviewBelowThreshold: outline.reviewBelowThreshold,
            reviewScoresCompletedAt: outline.reviewScoresCompletedAt?.toISO() ?? null,
          }
        : undefined,
    }
  }

  /** Hồ sơ đủ điều kiện lên lịch bảo vệ */
  static async listEligible() {
    const rows = await ProjectOutline.query()
      .where('status', 'PHANBIEN_KIN')
      .whereNotNull('review_scores_completed_at')
      .orderBy('review_scores_completed_at', 'asc')

    const result = []
    for (const o of rows) {
      const active = await ProjectOutlineDefenseSession.query()
        .where('project_outline_id', o.id)
        .whereIn('status', ['DRAFT', 'CONFIRMED'])
        .first()
      if (active) continue
      result.push(ProjectOutlineService.serialize(o))
    }
    return result
  }

  static async assertScoresComplete(outline: ProjectOutline) {
    if (outline.status !== 'PHANBIEN_KIN') {
      throw new Error('Thuyết minh phải ở trạng thái phản biện kín.')
    }
    if (!outline.reviewScoresCompletedAt) {
      throw new Error('Chưa đủ phiếu phản biện hợp lệ — không lên lịch bảo vệ.')
    }
  }

  static validateMeetingFields(
    mode: DefenseMeetingMode,
    location?: string | null,
    meetingUrl?: string | null
  ) {
    if (mode === 'IN_PERSON' || mode === 'HYBRID') {
      if (!location?.trim()) throw new Error('Cần nhập địa điểm họp.')
    }
    if (mode === 'ONLINE' || mode === 'HYBRID') {
      if (!meetingUrl?.trim()) throw new Error('Cần nhập link họp trực tuyến.')
    }
  }

  static validateCouncilComposition(members: MemberInput[]) {
    const chuTich = members.filter((m) => m.roleInCouncil === 'CHU_TICH')
    const thuKy = members.filter((m) => m.roleInCouncil === 'THU_KY')
    const uyVien = members.filter((m) => m.roleInCouncil === 'UY_VIEN')
    if (chuTich.length !== 1) throw new Error('Hội đồng cần đúng 1 Chủ tịch.')
    if (thuKy.length !== 1) throw new Error('Hội đồng cần đúng 1 Thư ký.')
    if (uyVien.length < 1) throw new Error('Hội đồng cần ít nhất 1 Ủy viên.')
    const external = members.filter((m) => m.isExternal)
    if (external.length < MIN_EXTERNAL_MEMBERS) {
      throw new Error(`Cần tối thiểu ${MIN_EXTERNAL_MEMBERS} thành viên ngoài trường.`)
    }
    for (const m of external) {
      if (!m.proposedSourceNote?.trim()) {
        throw new Error(`Thành viên ngoài "${m.memberName}" cần ghi nguồn đề xuất.`)
      }
    }
  }

  /** Xung đột lợi ích: owner, thành viên TM, phản biện kín đang/đã phân công */
  static async assertNoConflict(outlineId: number, members: MemberInput[]) {
    const outline = await ProjectOutline.findOrFail(outlineId)
    const outlineMembers = await ProjectOutlineMember.query().where(
      'project_outline_id',
      outlineId
    )
    const profileIds = new Set(
      outlineMembers.map((m) => m.profileId).filter((x): x is number => !!x)
    )
    const blockedUserIds = new Set<number>([outline.ownerId])

    for (const pid of profileIds) {
      const p = await ScientificProfile.find(pid)
      if (p?.userId) blockedUserIds.add(p.userId)
    }

    const reviewers = await ProjectOutlineReviewAssignment.query()
      .where('project_outline_id', outlineId)
      .whereIn('status', ['INVITED', 'ACTIVE', 'COMPLETED'])
    for (const r of reviewers) {
      if (r.reviewerUserId) blockedUserIds.add(r.reviewerUserId)
      if (r.scientificProfileId) profileIds.add(r.scientificProfileId)
    }

    for (const m of members) {
      if (m.userId && blockedUserIds.has(Number(m.userId))) {
        throw new Error(
          `"${m.memberName}" xung đột lợi ích (CNĐT / thành viên đề tài / phản biện kín).`
        )
      }
      if (m.scientificProfileId && profileIds.has(Number(m.scientificProfileId))) {
        throw new Error(`"${m.memberName}" xung đột lợi ích theo hồ sơ khoa học.`)
      }
    }
  }

  /** Trùng lịch thành viên (±2 giờ quanh meetingAt) */
  static async assertNoScheduleConflict(
    meetingAt: DateTime,
    members: MemberInput[],
    excludeSessionId?: number
  ) {
    const from = meetingAt.minus({ hours: 2 })
    const to = meetingAt.plus({ hours: 2 })
    const userIds = members.map((m) => m.userId).filter((x): x is number => !!x)
    if (!userIds.length) return

    const sessionsQ = ProjectOutlineDefenseSession.query()
      .whereIn('status', ['DRAFT', 'CONFIRMED'])
      .where('meeting_at', '>=', from.toSQL()!)
      .where('meeting_at', '<=', to.toSQL()!)
    if (excludeSessionId) sessionsQ.whereNot('id', excludeSessionId)
    const sessions = await sessionsQ

    for (const s of sessions) {
      const existing = await ProjectOutlineDefenseMember.query()
        .where('session_id', s.id)
        .whereIn('user_id', userIds)
      if (existing.length) {
        throw new Error(
          `"${existing[0].memberName}" trùng lịch bảo vệ khác (${s.meetingAt.toFormat(
            'dd/MM/yyyy HH:mm'
          )}).`
        )
      }
    }
  }

  static checkShortNotice(
    meetingAt: DateTime,
    override?: boolean,
    reason?: string | null
  ): { ok: boolean; needOverride: boolean } {
    const okDays = hasAtLeastBusinessDays(meetingAt, 5)
    if (okDays) return { ok: true, needOverride: false }
    if (override && reason?.trim() && reason.trim().length >= 5) {
      return { ok: true, needOverride: true }
    }
    return { ok: false, needOverride: true }
  }

  static async replaceMembers(sessionId: number, members: MemberInput[]) {
    await ProjectOutlineDefenseMember.query().where('session_id', sessionId).delete()
    const created: ProjectOutlineDefenseMember[] = []
    for (const m of members) {
      const row = await ProjectOutlineDefenseMember.create({
        sessionId,
        userId: m.userId ?? null,
        scientificProfileId: m.scientificProfileId ?? null,
        memberName: m.memberName.trim(),
        memberEmail: m.memberEmail?.trim() || null,
        roleInCouncil: m.roleInCouncil,
        isExternal: !!m.isExternal,
        unit: m.unit?.trim() || null,
        proposedSourceNote: m.proposedSourceNote?.trim() || null,
        attendance: 'PENDING',
      })
      created.push(row)
    }
    return created
  }

  static async createSession(
    actorId: number,
    payload: {
      projectOutlineId: number
      meetingMode: DefenseMeetingMode
      meetingAt: string
      location?: string | null
      meetingUrl?: string | null
      shortNoticeOverride?: boolean
      shortNoticeReason?: string | null
      confirm?: boolean
      members: MemberInput[]
    }
  ) {
    const outline = await ProjectOutline.find(payload.projectOutlineId)
    if (!outline) throw new Error('Không tìm thấy thuyết minh.')
    await this.assertScoresComplete(outline)

    const existing = await ProjectOutlineDefenseSession.query()
      .where('project_outline_id', outline.id)
      .whereIn('status', ['DRAFT', 'CONFIRMED'])
      .first()
    if (existing) throw new Error('Đã có buổi bảo vệ đang hiệu lực cho hồ sơ này.')

    const meetingAt = DateTime.fromISO(payload.meetingAt)
    if (!meetingAt.isValid) throw new Error('meetingAt không hợp lệ.')
    if (meetingAt <= DateTime.now()) throw new Error('Thời gian họp phải ở tương lai.')

    this.validateMeetingFields(payload.meetingMode, payload.location, payload.meetingUrl)
    this.validateCouncilComposition(payload.members)
    await this.assertNoConflict(outline.id, payload.members)
    await this.assertNoScheduleConflict(meetingAt, payload.members)

    const short = this.checkShortNotice(
      meetingAt,
      payload.shortNoticeOverride,
      payload.shortNoticeReason
    )
    if (!short.ok) {
      const err: any = new Error(
        'Lịch họp cách ngày gửi chưa đủ 5 ngày làm việc. Cần quyền ghi đè và lý do.'
      )
      err.code = 'LESS_THAN_5_BUSINESS_DAYS'
      throw err
    }

    const session = await ProjectOutlineDefenseSession.create({
      projectOutlineId: outline.id,
      status: 'DRAFT',
      meetingMode: payload.meetingMode,
      meetingAt,
      location: payload.location?.trim() || null,
      meetingUrl: payload.meetingUrl?.trim() || null,
      shortNoticeOverride: short.needOverride,
      shortNoticeReason: short.needOverride ? payload.shortNoticeReason?.trim() || null : null,
      createdBy: actorId,
      version: 1,
    })

    const members = await this.replaceMembers(session.id, payload.members)

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'CREATE_DEFENSE_SESSION',
      outline.status,
      outline.status,
      { sessionId: session.id, meetingAt: meetingAt.toISO() }
    )

    if (payload.confirm) {
      return this.confirmSession(session, outline, members, actorId)
    }

    return { session, members, outline }
  }

  static async confirmSession(
    session: ProjectOutlineDefenseSession,
    outline: ProjectOutline,
    members: ProjectOutlineDefenseMember[],
    actorId: number,
    opts?: { shortNoticeOverride?: boolean; shortNoticeReason?: string | null }
  ) {
    if (session.status === 'CONFIRMED') {
      return { session, members, outline } // idempotent
    }
    if (session.status !== 'DRAFT') {
      throw new Error('Chỉ xác nhận buổi ở trạng thái nháp.')
    }

    await this.assertScoresComplete(outline)
    const memberInputs: MemberInput[] = members.map((m) => ({
      userId: m.userId,
      scientificProfileId: m.scientificProfileId,
      memberName: m.memberName,
      memberEmail: m.memberEmail,
      roleInCouncil: m.roleInCouncil,
      isExternal: m.isExternal,
      unit: m.unit,
      proposedSourceNote: m.proposedSourceNote,
    }))
    this.validateMeetingFields(session.meetingMode, session.location, session.meetingUrl)
    this.validateCouncilComposition(memberInputs)
    await this.assertNoConflict(outline.id, memberInputs)
    await this.assertNoScheduleConflict(session.meetingAt, memberInputs, session.id)

    const short = this.checkShortNotice(
      session.meetingAt,
      opts?.shortNoticeOverride ?? session.shortNoticeOverride,
      opts?.shortNoticeReason ?? session.shortNoticeReason
    )
    if (!short.ok) {
      const err: any = new Error(
        'Lịch họp cách ngày gửi chưa đủ 5 ngày làm việc. Cần quyền ghi đè và lý do.'
      )
      err.code = 'LESS_THAN_5_BUSINESS_DAYS'
      throw err
    }

    const from = outline.status
    session.status = 'CONFIRMED'
    if (short.needOverride) {
      session.shortNoticeOverride = true
      session.shortNoticeReason =
        opts?.shortNoticeReason?.trim() || session.shortNoticeReason
    }
    await session.save()

    outline.status = 'BAOVE_PENDING'
    outline.activeDefenseSessionId = session.id
    outline.defenseScheduledAt = session.meetingAt
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'CONFIRM_DEFENSE_SESSION',
      from,
      'BAOVE_PENDING',
      { sessionId: session.id }
    )

    await this.notifyInvite(session, outline, members)
    return { session, members, outline }
  }

  static async notifyInvite(
    session: ProjectOutlineDefenseSession,
    outline: ProjectOutline,
    members: ProjectOutlineDefenseMember[]
  ) {
    const when = session.meetingAt.toFormat('dd/MM/yyyy HH:mm')
    const subject = `[KH&CN] Thư mời bảo vệ thuyết minh ${outline.code}`
    const body = [
      `Kính mời tham dự buổi bảo vệ thuyết minh đề tài:`,
      `- Mã: ${outline.code}`,
      `- Tên: ${outline.title}`,
      `- Chủ nhiệm: ${outline.ownerName}`,
      `- Thời gian: ${when}`,
      `- Hình thức: ${session.meetingMode}`,
      session.location ? `- Địa điểm: ${session.location}` : '',
      session.meetingUrl ? `- Link: ${session.meetingUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    for (const m of members) {
      if (m.userId) {
        await NotificationService.push(m.userId, {
          type: 'PROJECT_UPDATE',
          title: 'Lời mời bảo vệ thuyết minh',
          message: `${outline.code} — ${when}`,
          link: `/projects/defenses/${session.id}`,
        })
      }
      if (m.memberEmail) {
        await EmailLogService.logStub({
          toEmail: m.memberEmail,
          subject,
          body,
          relatedType: 'project_outline_defense_session',
          relatedId: session.id,
        })
      }
    }

    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Lịch bảo vệ thuyết minh',
        message: `${outline.code} — ${when}`,
        link: `/projects/my`,
      })
      if (outline.ownerEmail) {
        await EmailLogService.logStubToUser(
          outline.ownerId,
          subject,
          body.replace('Kính mời tham dự', 'Thông báo lịch'),
          'project_outline_defense_session',
          session.id
        )
      }
    }
  }

  static async cancelSession(
    session: ProjectOutlineDefenseSession,
    actorId: number,
    reason: string
  ) {
    if (session.status === 'FINALIZED') throw new Error('Buổi đã chốt biên bản — không hủy.')
    if (session.status === 'CANCELLED') return session

    const outline = await ProjectOutline.findOrFail(session.projectOutlineId)
    const from = outline.status
    session.status = 'CANCELLED'
    session.cancelledAt = DateTime.now()
    session.cancelReason = reason.trim()
    await session.save()

    if (outline.activeDefenseSessionId === session.id) {
      outline.activeDefenseSessionId = null
      outline.defenseScheduledAt = null
      if (outline.status === 'BAOVE_PENDING') {
        outline.status = 'PHANBIEN_KIN'
      }
      await outline.save()
    }

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'CANCEL_DEFENSE_SESSION',
      from,
      outline.status,
      { sessionId: session.id, reason }
    )

    const members = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
    for (const m of members) {
      if (m.userId) {
        await NotificationService.push(m.userId, {
          type: 'PROJECT_UPDATE',
          title: 'Hủy buổi bảo vệ thuyết minh',
          message: `${outline.code}: ${reason}`,
          link: `/projects/defenses`,
        })
      }
    }
    return session
  }

  static async saveMinutes(
    session: ProjectOutlineDefenseSession,
    payload: {
      discussionNotes: string
      finalScore?: number | null
      conclusion?: DefenseConclusion | null
      adjustmentRequirements?: string | null
      adjustmentDeadline?: string | null
      attendances?: Array<{ memberId: number; attendance: 'PENDING' | 'PRESENT' | 'ABSENT' }>
    },
    actorId: number
  ) {
    if (session.status !== 'CONFIRMED') {
      throw new Error('Chỉ ghi biên bản khi buổi đã xác nhận lịch.')
    }
    if (payload.attendances?.length) {
      for (const a of payload.attendances) {
        const m = await ProjectOutlineDefenseMember.find(a.memberId)
        if (m && m.sessionId === session.id) {
          m.attendance = a.attendance
          await m.save()
        }
      }
    }
    session.discussionNotes = payload.discussionNotes.trim()
    session.finalScore = payload.finalScore ?? null
    session.conclusion = payload.conclusion ?? null
    session.adjustmentRequirements = payload.adjustmentRequirements?.trim() || null
    if (payload.adjustmentDeadline) {
      const d = DateTime.fromISO(payload.adjustmentDeadline)
      session.adjustmentDeadline = d.isValid ? d.endOf('day') : null
    } else {
      session.adjustmentDeadline = null
    }
    await session.save()

    await ProjectOutlineService.writeAudit(
      session.projectOutlineId,
      actorId,
      'SAVE_DEFENSE_MINUTES_DRAFT',
      'BAOVE_PENDING',
      'BAOVE_PENDING',
      { sessionId: session.id }
    )
    return session
  }

  static async finalize(
    session: ProjectOutlineDefenseSession,
    payload: {
      discussionNotes: string
      finalScore?: number | null
      conclusion: DefenseConclusion
      adjustmentRequirements?: string | null
      adjustmentDeadline?: string | null
      attendances: Array<{ memberId: number; attendance: 'PRESENT' | 'ABSENT' }>
    },
    actorId: number
  ) {
    if (session.status === 'FINALIZED') {
      // idempotent
      const outline = await ProjectOutline.findOrFail(session.projectOutlineId)
      const members = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
      return { session, outline, members }
    }
    if (session.status !== 'CONFIRMED') {
      throw new Error('Chỉ chốt biên bản khi buổi đã xác nhận.')
    }

    // Cập nhật điểm danh
    for (const a of payload.attendances) {
      const m = await ProjectOutlineDefenseMember.find(a.memberId)
      if (m && m.sessionId === session.id) {
        m.attendance = a.attendance
        await m.save()
      }
    }

    const members = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
    const present = members.filter((m) => m.attendance === 'PRESENT')
    const hasChuTich = present.some((m) => m.roleInCouncil === 'CHU_TICH')
    const hasThuKy = present.some((m) => m.roleInCouncil === 'THU_KY')
    if (!hasChuTich || !hasThuKy || present.length < 3) {
      throw new Error(
        'Không đủ điều kiện chốt biên bản: cần Chủ tịch, Thư ký và đủ thành viên có mặt.'
      )
    }

    if (payload.conclusion === 'THONG_QUA_DIEU_CHINH') {
      if (!payload.adjustmentRequirements?.trim()) {
        throw new Error('Cần nhập yêu cầu chỉnh sửa.')
      }
      if (!payload.adjustmentDeadline) {
        throw new Error('Cần chọn hạn chỉnh sửa.')
      }
    }

    session.discussionNotes = payload.discussionNotes.trim()
    session.finalScore = payload.finalScore ?? null
    session.conclusion = payload.conclusion
    session.adjustmentRequirements = payload.adjustmentRequirements?.trim() || null
    if (payload.adjustmentDeadline) {
      const d = DateTime.fromISO(payload.adjustmentDeadline)
      if (!d.isValid) throw new Error('Hạn chỉnh sửa không hợp lệ.')
      session.adjustmentDeadline = d.endOf('day')
    }

    const outline = await ProjectOutline.findOrFail(session.projectOutlineId)
    const from = outline.status

    // Điểm phản biện để đưa vào biên bản (sau khi đủ phiếu — không còn blind)
    const sheets = await ProjectOutlineReviewScoreSheet.query()
      .where('project_outline_id', outline.id)
      .where('status', 'SUBMITTED')
    const assignments = await ProjectOutlineReviewAssignment.query().where(
      'project_outline_id',
      outline.id
    )
    const reviewScores = sheets.map((sh, i) => {
      const a = assignments.find((x) => x.id === sh.assignmentId)
      return {
        reviewerLabel: a ? `Phản biện #${i + 1}` : `Phiếu #${sh.id}`,
        totalScore: sh.totalScore == null ? null : Number(sh.totalScore),
      }
    })

    const { html, relativeUrl } = await generateDefenseMinutesHtml(
      session,
      outline,
      members,
      reviewScores
    )
    session.minutesHtml = html
    session.minutesFileUrl = relativeUrl
    session.status = 'FINALIZED'
    session.finalizedAt = DateTime.now()
    session.finalizedBy = actorId
    session.version = (session.version || 1) + 1
    await session.save()

    let nextStatus: ProjectOutline['status'] = 'BAOVE_KHONG_DAT'
    if (payload.conclusion === 'THONG_QUA') nextStatus = 'CHO_XAC_NHAN_KP'
    else if (payload.conclusion === 'THONG_QUA_DIEU_CHINH') nextStatus = 'CHINH_SUA_TM'

    outline.status = nextStatus
    outline.defenseConclusion = payload.conclusion
    outline.defenseFinalizedAt = session.finalizedAt
    await outline.save()

    if (payload.conclusion === 'THONG_QUA_DIEU_CHINH') {
      const ProjectOutlineRevisionService = (await import('#services/project_outline_revision_service'))
        .default
      await ProjectOutlineRevisionService.openRevisionPeriod(outline, session, actorId)
    }

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'FINALIZE_DEFENSE',
      from,
      nextStatus,
      {
        sessionId: session.id,
        conclusion: payload.conclusion,
        minutesFileUrl: relativeUrl,
      }
    )

    // Thông báo CNĐT
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Kết luận bảo vệ thuyết minh',
        message: `${outline.code}: ${payload.conclusion}`,
        link: `/projects/my`,
      })
      if (outline.ownerEmail) {
        await EmailLogService.logStubToUser(
          outline.ownerId,
          `[KH&CN] Biên bản bảo vệ ${outline.code}`,
          `Kết luận: ${payload.conclusion}\nBiên bản: ${relativeUrl}\n${
            session.discussionNotes || ''
          }`,
          'project_outline_defense_session',
          session.id
        )
      }
    }

    await NotificationService.pushToPermission('project.review', {
      type: 'PROJECT_UPDATE',
      title: 'Đã chốt biên bản bảo vệ',
      message: `${outline.code} → ${nextStatus}`,
      link: `/projects/defenses/${session.id}`,
    })

    return { session, outline, members }
  }
}
