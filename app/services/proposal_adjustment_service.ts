import { DateTime } from 'luxon'
import ProjectProposal from '#models/project_proposal'
import ProjectProposalAdjustmentVersion from '#models/project_proposal_adjustment_version'
import { addBusinessDays, countBusinessDays } from '#utils/business_days'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'

/**
 * US-03-05 — mở kỳ điều chỉnh khi đề xuất chuyển DIEU_CHINH.
 * Ngày bắt đầu hạn = thời điểm thông báo/email stub (BGH duyệt).
 */
export default class ProposalAdjustmentService {
  static async openForProposal(proposal: ProjectProposal, actorUserId?: number | null) {
    const now = DateTime.now()
    proposal.adjustmentNotifiedAt = now
    proposal.adjustmentDueAt = addBusinessDays(now, 5)
    proposal.adjustmentOverdue = false
    proposal.adjustmentReminderSentAt = null
    proposal.adjustmentExplanation = null
    proposal.canWriteOutline = false
    await proposal.save()

    // Bản gốc — chỉ tạo nếu chưa có (tránh trùng khi admin sửa lại)
    const existing = await ProjectProposalAdjustmentVersion.query()
      .where('project_proposal_id', proposal.id)
      .where('version_type', 'ORIGINAL')
      .first()
    if (!existing) {
      await ProjectProposalAdjustmentVersion.create({
        projectProposalId: proposal.id,
        versionType: 'ORIGINAL',
        title: proposal.title,
        objectives: proposal.objectives,
        councilAdjustmentNote: proposal.councilAdjustmentNote,
        explanationNote: null,
        createdBy: actorUserId ?? null,
      })
    } else {
      // Cập nhật bản gốc nếu chưa nộp lại (chưa có SUBMITTED)
      const submitted = await ProjectProposalAdjustmentVersion.query()
        .where('project_proposal_id', proposal.id)
        .where('version_type', 'SUBMITTED')
        .first()
      if (!submitted) {
        existing.title = proposal.title
        existing.objectives = proposal.objectives
        existing.councilAdjustmentNote = proposal.councilAdjustmentNote
        await existing.save()
      }
    }
  }

  static refreshOverdue(p: ProjectProposal): boolean {
    if (p.status !== 'DIEU_CHINH' || !p.adjustmentDueAt) return false
    const overdue = DateTime.now() > p.adjustmentDueAt
    if (overdue !== p.adjustmentOverdue) {
      p.adjustmentOverdue = overdue
      return true
    }
    return false
  }

  /** Nhắc hạn ngày làm việc thứ 4 — trả về số đề xuất đã nhắc. */
  static async sendDay4Reminders(): Promise<number> {
    const rows = await ProjectProposal.query().where('status', 'DIEU_CHINH')
    let sent = 0
    for (const p of rows) {
      if (!p.adjustmentNotifiedAt || p.adjustmentReminderSentAt) continue
      const days = countBusinessDays(p.adjustmentNotifiedAt, DateTime.now())
      if (days < 4) continue

      const dueLabel = p.adjustmentDueAt?.toFormat('dd/MM/yyyy HH:mm') || '—'
      await NotificationService.push(p.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Nhắc hạn điều chỉnh đề xuất',
        message: `Đề xuất ${p.code} cần nộp lại điều chỉnh trước ${dueLabel}.`,
        link: `/projects/register/form/${p.id}`,
      })
      await EmailLogService.logStubToUser(
        p.ownerId,
        `[KH&CN] Nhắc hạn điều chỉnh đề xuất ${p.code}`,
        `Đề xuất "${p.title}" (${p.code}) đang ở trạng thái cần điều chỉnh.\n\nYêu cầu Hội đồng:\n${p.councilAdjustmentNote || '—'}\n\nHạn nộp lại: ${dueLabel}.\nĐây là email nhắc (ngày làm việc thứ 4).`,
        'project_proposal_adjustment_reminder',
        p.id
      )
      p.adjustmentReminderSentAt = DateTime.now()
      await p.save()
      sent++
    }
    return sent
  }
}
