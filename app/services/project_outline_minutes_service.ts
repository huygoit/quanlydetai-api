import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import ProjectOutlineDefenseScoreSheet from '#models/project_outline_defense_score_sheet'
import ProjectOutlineDefenseMinutesItem from '#models/project_outline_defense_minutes_item'
import type { CouncilMinutesConclusion } from '#models/project_outline_defense_minutes_item'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectOutlineAppraisalService from '#services/project_outline_appraisal_service'
import { generateAppraisalMinutesHtml } from '#utils/appraisal_minutes'

type ItemInput = {
  projectOutlineId: number
  councilConclusion: CouncilMinutesConclusion
  executionContent?: string | null
  adjustmentRequirements?: string | null
  adjustmentDeadline?: string | null
  note?: string | null
}

type AttendanceInput = { memberId: number; attendance: 'PRESENT' | 'ABSENT' | 'PENDING' }

/**
 * Biên bản họp HĐ thẩm định (BM-02.10 / BM.05b) — chỉ Thư ký phiên được ghi/chốt.
 */
export default class ProjectOutlineMinutesService {
  static async assertThuKy(sessionId: number, userId: number) {
    const thuKy = await ProjectOutlineDefenseMember.query()
      .where('session_id', sessionId)
      .where('role_in_council', 'THU_KY')
      .where('user_id', userId)
      .first()
    if (!thuKy) throw new Error('Chỉ Thư ký hội đồng của phiên này được ghi biên bản.')
    return thuKy
  }

  static serializeItem(row: ProjectOutlineDefenseMinutesItem, outline?: ProjectOutline | null) {
    return {
      id: row.id,
      sessionId: row.sessionId,
      projectOutlineId: row.projectOutlineId,
      averageScore: row.averageScore == null ? null : Number(row.averageScore),
      validSheetCount: row.validSheetCount,
      invalidSheetCount: row.invalidSheetCount,
      councilConclusion: row.councilConclusion,
      executionContent: row.executionContent,
      adjustmentRequirements: row.adjustmentRequirements,
      adjustmentDeadline: row.adjustmentDeadline?.toISO() ?? null,
      note: row.note,
      outline: outline
        ? {
            id: outline.id,
            code: outline.code,
            title: outline.title,
            ownerName: outline.ownerName,
            ownerUnit: outline.ownerUnit,
            status: outline.status,
          }
        : null,
    }
  }

  /** Tổng hợp điểm BM.05a: hợp lệ = đã nộp; không hợp lệ = chưa nộp */
  static async computeScoreSummary(sessionId: number, outlineId: number) {
    const members = await ProjectOutlineDefenseMember.query().where('session_id', sessionId)
    const sheets = await ProjectOutlineDefenseScoreSheet.query()
      .where('session_id', sessionId)
      .where('project_outline_id', outlineId)

    const byMember = new Map(sheets.map((s) => [s.memberId, s]))
    const memberScores: Array<{
      memberId: number
      memberName: string
      roleInCouncil: string
      status: string
      totalScore: number | null
      conclusion: string | null
    }> = []

    let valid = 0
    let invalid = 0
    let sum = 0
    for (const m of members) {
      const sh = byMember.get(m.id)
      const submitted = sh?.status === 'SUBMITTED'
      if (submitted) {
        valid += 1
        sum += Number(sh!.totalScore || 0)
      } else {
        invalid += 1
      }
      memberScores.push({
        memberId: m.id,
        memberName: m.memberName,
        roleInCouncil: m.roleInCouncil,
        status: submitted ? 'SUBMITTED' : 'DRAFT',
        totalScore: submitted && sh?.totalScore != null ? Number(sh.totalScore) : null,
        conclusion: submitted ? sh?.conclusion || null : null,
      })
    }
    const averageScore = valid ? Math.round((sum / valid) * 100) / 100 : null
    return {
      totalBallots: members.length,
      validBallots: valid,
      invalidBallots: invalid,
      averageScore,
      memberScores,
    }
  }

  static async getMinutesContext(session: ProjectOutlineDefenseSession) {
    const members = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
    const outlines = await ProjectOutlineAppraisalService.loadOutlines(session.id)
    const items = await ProjectOutlineDefenseMinutesItem.query().where('session_id', session.id)
    const itemByOid = new Map(items.map((i) => [Number(i.projectOutlineId), i]))

    const outlineBlocks = []
    for (const o of outlines) {
      const summary = await this.computeScoreSummary(session.id, o.id)
      const item = itemByOid.get(Number(o.id))
      outlineBlocks.push({
        outline: {
          id: o.id,
          code: o.code,
          title: o.title,
          ownerName: o.ownerName,
          ownerUnit: o.ownerUnit,
          status: o.status,
          requestedBudget: Number(o.requestedBudget || 0),
        },
        scoreSummary: summary,
        minutesItem: item ? this.serializeItem(item, o) : null,
      })
    }

    const allSubmitted = outlineBlocks.every((b) => b.scoreSummary.invalidBallots === 0)
    const meetingReached = session.meetingAt <= DateTime.now()
    const earlyOpened = !!session.earlyMeetingOpened
    // Đủ điều kiện họp: đã tới lịch hoặc PKH xác nhận họp trước
    const meetingOk = meetingReached || earlyOpened
    const canOpenMinutes =
      ['PUBLISHED', 'CONFIRMED', 'FINALIZED'].includes(session.status) &&
      (allSubmitted || session.status === 'FINALIZED') &&
      (meetingOk || session.status === 'FINALIZED')

    return {
      sessionId: session.id,
      status: session.status,
      decisionCode: session.decisionCode,
      meetingAt: session.meetingAt?.toISO() ?? null,
      location: session.location,
      meetingUrl: session.meetingUrl,
      meetingMode: session.meetingMode,
      recommendations: session.recommendations ?? null,
      totalBallots: session.totalBallots,
      validBallots: session.validBallots,
      invalidBallots: session.invalidBallots,
      minutesFileUrl: session.minutesFileUrl,
      finalizedAt: session.finalizedAt?.toISO() ?? null,
      locked: session.status === 'FINALIZED',
      canOpenMinutes,
      canReopenMinutes: await this.canReopenMinutes(session, outlines),
      allSubmitted,
      meetingReached,
      earlyMeetingOpened: earlyOpened,
      earlyMeetingOpenedAt: session.earlyMeetingOpenedAt?.toISO() ?? null,
      meetingOk,
      minutesReopenedAt: session.minutesReopenedAt?.toISO() ?? null,
      gateMessage: !allSubmitted
        ? 'Còn thành viên chưa nộp BM.05a (phiếu không hợp lệ).'
        : !meetingOk
          ? 'Chưa đến ngày họp — PKH cần bấm «Họp trước ngày dự kiến» hoặc chờ đến lịch họp.'
          : null,
      members: members.map((m) => ({
        id: m.id,
        memberName: m.memberName,
        roleInCouncil: m.roleInCouncil,
        attendance: m.attendance,
        unit: m.unit,
        userId: m.userId,
      })),
      outlines: outlineBlocks,
    }
  }

  static async saveDraft(
    session: ProjectOutlineDefenseSession,
    actorId: number,
    payload: {
      recommendations?: string | null
      attendances?: AttendanceInput[]
      items: ItemInput[]
    }
  ) {
    await this.assertThuKy(session.id, actorId)
    if (session.status === 'FINALIZED') throw new Error('Biên bản đã khóa — không sửa.')
    if (!['PUBLISHED', 'CONFIRMED'].includes(session.status)) {
      throw new Error('Chỉ ghi biên bản sau khi đã phát hành QĐ.')
    }
    const meetingReached = session.meetingAt <= DateTime.now()
    if (!meetingReached && !session.earlyMeetingOpened) {
      throw new Error(
        'Chưa đến ngày họp — chờ lịch họp hoặc PKH xác nhận «Họp trước ngày dự kiến».'
      )
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

    let totalValid = 0
    let totalInvalid = 0
    let total = 0

    for (const raw of payload.items) {
      const summary = await this.computeScoreSummary(session.id, raw.projectOutlineId)
      total += summary.totalBallots
      totalValid += summary.validBallots
      totalInvalid += summary.invalidBallots

      if (raw.councilConclusion === 'HOAN_THIEN' && !raw.adjustmentRequirements?.trim()) {
        throw new Error('Đề nghị hoàn thiện hồ sơ — bắt buộc nhập nội dung điều chỉnh.')
      }

      let row = await ProjectOutlineDefenseMinutesItem.query()
        .where('session_id', session.id)
        .where('project_outline_id', raw.projectOutlineId)
        .first()
      if (!row) {
        row = new ProjectOutlineDefenseMinutesItem()
        row.sessionId = session.id
        row.projectOutlineId = raw.projectOutlineId
      }
      row.averageScore = summary.averageScore
      row.validSheetCount = summary.validBallots
      row.invalidSheetCount = summary.invalidBallots
      row.councilConclusion = raw.councilConclusion
      row.executionContent = raw.executionContent?.trim() || null
      row.adjustmentRequirements = raw.adjustmentRequirements?.trim() || null
      row.note = raw.note?.trim() || null
      if (raw.adjustmentDeadline) {
        const d = DateTime.fromISO(raw.adjustmentDeadline)
        row.adjustmentDeadline = d.isValid ? d.endOf('day') : null
      } else {
        row.adjustmentDeadline = null
      }
      await row.save()
    }

    session.recommendations = payload.recommendations?.trim() || null
    session.totalBallots = total || null
    session.validBallots = totalValid || null
    session.invalidBallots = totalInvalid || null
    await session.save()

    return this.getMinutesContext(session)
  }

  static async finalize(
    session: ProjectOutlineDefenseSession,
    actorId: number,
    payload: {
      recommendations?: string | null
      attendances?: AttendanceInput[]
      items: ItemInput[]
    }
  ) {
    await this.assertThuKy(session.id, actorId)
    if (session.status === 'FINALIZED') {
      return this.getMinutesContext(session)
    }

    const ctx = await this.getMinutesContext(session)
    if (!ctx.allSubmitted) {
      throw new Error('Còn phiếu BM.05a chưa nộp — không chốt biên bản.')
    }
    if (!ctx.meetingOk) {
      throw new Error(
        'Chưa đến ngày họp — chờ lịch họp hoặc PKH xác nhận «Họp trước ngày dự kiến».'
      )
    }

    const members = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
    if (payload.attendances?.length) {
      for (const a of payload.attendances) {
        const m = members.find((x) => x.id === a.memberId)
        if (m) {
          m.attendance = a.attendance
          await m.save()
        }
      }
    }
    await members[0]?.refresh?.()
    const refreshed = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
    const present = refreshed.filter((m) => m.attendance === 'PRESENT')
    if (
      !present.some((m) => m.roleInCouncil === 'CHU_TICH') ||
      !present.some((m) => m.roleInCouncil === 'THU_KY')
    ) {
      throw new Error('Cần ghi nhận Chủ tịch và Thư ký có mặt trước khi chốt.')
    }

    // Lưu draft trước
    await this.saveDraft(session, actorId, payload)
    await session.refresh()

    const items = await ProjectOutlineDefenseMinutesItem.query().where('session_id', session.id)
    if (!items.length || items.some((i) => !i.councilConclusion)) {
      throw new Error('Mỗi thuyết minh cần có kết luận hội đồng.')
    }

    const outlines = await ProjectOutlineAppraisalService.loadOutlines(session.id)
    const scoreBlocks = []
    for (const o of outlines) {
      scoreBlocks.push({
        outline: o,
        summary: await this.computeScoreSummary(session.id, o.id),
        item: items.find((i) => Number(i.projectOutlineId) === Number(o.id))!,
      })
    }

    const { html, relativeUrl } = await generateAppraisalMinutesHtml(
      session,
      refreshed,
      scoreBlocks
    )
    session.minutesHtml = html
    session.minutesFileUrl = relativeUrl
    session.status = 'FINALIZED'
    session.finalizedAt = DateTime.now()
    session.finalizedBy = actorId
    session.version = (session.version || 1) + 1
    // Kết luận phiên = kết luận TM đầu (tương thích cột cũ)
    const first = items[0]
    session.conclusion =
      first.councilConclusion === 'HOAN_THIEN'
        ? 'THONG_QUA_DIEU_CHINH'
        : first.councilConclusion === 'KHONG_DE_XUAT'
          ? 'KHONG_THONG_QUA'
          : 'THONG_QUA'
    session.adjustmentRequirements = first.adjustmentRequirements
    session.adjustmentDeadline = first.adjustmentDeadline
    await session.save()

    for (const block of scoreBlocks) {
      await this.applyOutlineResult(session, block.outline, block.item, actorId, relativeUrl)
    }

    return this.getMinutesContext(session)
  }

  private static async applyOutlineResult(
    session: ProjectOutlineDefenseSession,
    outline: ProjectOutline,
    item: ProjectOutlineDefenseMinutesItem,
    actorId: number,
    minutesUrl: string
  ) {
    const from = outline.status
    const ketLuan = item.councilConclusion!

    outline.defenseConclusion =
      ketLuan === 'HOAN_THIEN'
        ? 'THONG_QUA_DIEU_CHINH'
        : ketLuan === 'KHONG_DE_XUAT'
          ? 'KHONG_THONG_QUA'
          : 'THONG_QUA'
    outline.defenseFinalizedAt = session.finalizedAt

    if (ketLuan === 'DE_XUAT_XET' || ketLuan === 'GIAO_TRUC_TIEP') {
      // Thông qua → trình BGH phê duyệt (không nhảy Module 5 ngay)
      await outline.save()
      const FinalApproval = (await import('#services/project_outline_final_approval_service')).default
      await FinalApproval.enqueueForBgh(outline, actorId, {
        sessionId: session.id,
        conclusion: ketLuan,
        minutesUrl,
      })
      if (outline.ownerId) {
        await EmailLogService.logStubToUser(
          outline.ownerId,
          `[KH&CN] Biên bản thẩm định ${outline.code}`,
          `Kết luận: Thông qua — hồ sơ trình BGH phê duyệt.\nBiên bản: ${minutesUrl}`,
          'project_outline_defense_session',
          session.id
        )
      }
      return
    }

    if (ketLuan === 'HOAN_THIEN') {
      outline.status = 'CHINH_SUA_TM'
      await outline.save()
      session.adjustmentRequirements = item.adjustmentRequirements
      session.adjustmentDeadline = item.adjustmentDeadline
      await session.save()
      const ProjectOutlineRevisionService = (
        await import('#services/project_outline_revision_service')
      ).default
      // Mở kỳ hoàn thiện + thông báo/mail biên bản cho CNĐT và mọi thành viên đề tài
      await ProjectOutlineRevisionService.openRevisionPeriod(outline, session, actorId, {
        minutesUrl,
        adjustmentRequirements: item.adjustmentRequirements,
      })
      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        'MINUTES_NEED_REVISION',
        from,
        'CHINH_SUA_TM',
        { sessionId: session.id, minutesUrl }
      )
      return
    }

    // KHONG_DE_XUAT — dừng / không giao thực hiện
    outline.status = 'BAOVE_KHONG_DAT'
    await outline.save()
    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'MINUTES_REJECT',
      from,
      'BAOVE_KHONG_DAT',
      { sessionId: session.id, minutesUrl }
    )
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Thuyết minh không được thông qua',
        message: `${outline.code}: Hội đồng không đề nghị xét / giao thực hiện.`,
        link: `/projects/my`,
      })
      await EmailLogService.logStubToUser(
        outline.ownerId,
        `[KH&CN] Kết luận thẩm định ${outline.code}`,
        `Kết luận: Không thông qua\nBiên bản: ${minutesUrl}`,
        'project_outline_defense_session',
        session.id
      )
    }
  }

  /** BGH đã duyệt/ký số trên bất kỳ TM nào → không mở khóa biên bản. */
  private static async canReopenMinutes(
    session: ProjectOutlineDefenseSession,
    outlines?: ProjectOutline[]
  ) {
    if (session.status !== 'FINALIZED') return false
    const list = outlines || (await ProjectOutlineAppraisalService.loadOutlines(session.id))
    if (!list.length) return false
    const blocked = new Set([
      'CHO_HC_PHAT_HANH_QD',
      'SAN_SANG_THUC_HIEN',
      'KHONG_PHE_DUYET',
    ])
    for (const o of list) {
      if (o.bghSignedAt) return false
      if (blocked.has(o.status)) return false
    }
    return true
  }

  /**
   * PKH hoặc Thư ký mở khóa biên bản đã chốt (BGH chưa duyệt/ký) để cập nhật lại.
   */
  static async reopenMinutes(session: ProjectOutlineDefenseSession, actorId: number, reason?: string | null) {
    if (session.status !== 'FINALIZED') {
      throw new Error('Chỉ mở khóa khi biên bản đã chốt.')
    }
    const outlines = await ProjectOutlineAppraisalService.loadOutlines(session.id)
    if (!(await this.canReopenMinutes(session, outlines))) {
      throw new Error(
        'Không mở khóa — BGH đã duyệt/ký số hoặc hồ sơ đã qua bước phát hành QĐ giao nhiệm vụ.'
      )
    }

    for (const o of outlines) {
      const from = o.status
      // Đưa TM về trạng thái đang thẩm định để chờ chốt lại
      if (
        ['CHO_BGH_DUYET_TM', 'CHINH_SUA_TM', 'BAOVE_KHONG_DAT'].includes(o.status) ||
        o.defenseFinalizedAt
      ) {
        o.status = 'BAOVE_PENDING'
        o.revisionGateStatus = null
        o.defenseFinalizedAt = null
        o.defenseConclusion = null
        o.bghDecisionNote = null
        o.bghRejectReason = null
        o.bghSignedAt = null
        o.bghSignedBy = null
        await o.save()
        await ProjectOutlineService.writeAudit(
          o.id,
          actorId,
          'REOPEN_DEFENSE_MINUTES',
          from,
          'BAOVE_PENDING',
          { sessionId: session.id, reason: reason || null }
        )
      }
    }

    session.status = 'PUBLISHED'
    session.finalizedAt = null
    session.finalizedBy = null
    session.conclusion = null
    session.minutesReopenedAt = DateTime.now()
    session.minutesReopenedBy = actorId
    session.minutesLockedReason = reason?.trim() || 'Mở khóa để cập nhật biên bản'
    await session.save()

    return this.getMinutesContext(session)
  }

  /**
   * PKH xác nhận phiên đã họp trước lịch dự kiến → Thư ký soạn/chốt biên bản sớm.
   */
  static async openEarlyMeeting(session: ProjectOutlineDefenseSession, actorId: number) {
    if (!['PUBLISHED', 'CONFIRMED'].includes(session.status)) {
      throw new Error('Chỉ mở họp sớm sau khi đã phát hành QĐ thành lập HĐ.')
    }
    if (session.earlyMeetingOpened) {
      return session
    }
    if (session.meetingAt <= DateTime.now()) {
      throw new Error('Đã tới/qua thời điểm họp dự kiến — không cần xác nhận họp trước.')
    }

    session.earlyMeetingOpened = true
    session.earlyMeetingOpenedAt = DateTime.now()
    session.earlyMeetingOpenedBy = actorId
    await session.save()

    const thuKy = await ProjectOutlineDefenseMember.query()
      .where('session_id', session.id)
      .where('role_in_council', 'THU_KY')
      .first()
    if (thuKy?.userId) {
      await NotificationService.push(thuKy.userId, {
        type: 'PROJECT_UPDATE',
        title: 'Được soạn biên bản thẩm định sớm',
        message: `${session.decisionCode || `Phiên #${session.id}`}: PKH xác nhận họp trước lịch — vào tab Biên bản để soạn, xuất PDF và gửi.`,
        link: `/projects/defenses/${session.id}`,
      })
    }

    return session
  }
}
