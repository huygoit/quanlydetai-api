import { DateTime } from 'luxon'
import CallForProposal from '#models/call_for_proposal'
import type { CfpPeriodKind, CfpStatus } from '#models/call_for_proposal'
import CallForProposalAudit from '#models/call_for_proposal_audit'
import type { CfpAuditAction } from '#models/call_for_proposal_audit'
import SubmissionPeriod from '#models/submission_period'
import CfpEmailJob from '#models/cfp_email_job'
import Staff from '#models/staff'
import NotificationService from '#services/notification_service'
import PermissionService from '#services/permission_service'
import EmailLogService from '#services/email_log_service'
import MailService from '#services/mail_service'
import type { ProjectProposalLevel } from '#models/project_proposal'
import db from '@adonisjs/lucid/services/db'

const LINK_LIST = '/projects/call-for-proposals'
const LINK_DETAIL = (id: number) => `/projects/call-for-proposals/${id}`

export type CfpWritePayload = {
  title: string
  periodKind: CfpPeriodKind
  periodLabel: string
  deadlineAt: string
  levels: ProjectProposalLevel[]
  contentHtml?: string | null
  attachmentUrls?: string[]
}

export default class CallForProposalService {
  /** Deadline phải ≥ hôm nay + 10 ngày (đầu ngày). */
  static assertDeadlineMin10Days(deadlineIso: string) {
    const d = DateTime.fromISO(deadlineIso, { zone: 'local' }).startOf('day')
    if (!d.isValid) {
      throw new Error('INVALID_DEADLINE')
    }
    const min = DateTime.local().startOf('day').plus({ days: 10 })
    if (d < min) {
      throw new Error('DEADLINE_TOO_SOON')
    }
    return d.endOf('day')
  }

  static parseDeadline(deadlineIso: string): DateTime {
    const d = DateTime.fromISO(deadlineIso, { zone: 'local' })
    if (!d.isValid) throw new Error('INVALID_DEADLINE')
    // Nếu chỉ có ngày → end of day
    if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineIso.trim())) {
      return d.endOf('day')
    }
    return d
  }

  static async writeAudit(
    cfpId: number,
    actorUserId: number,
    action: CfpAuditAction,
    note?: string | null,
    diffJson?: Record<string, unknown> | null
  ) {
    await CallForProposalAudit.create({
      callForProposalId: cfpId,
      actorUserId,
      action,
      note: note ?? null,
      diffJson: diffJson ?? null,
    })
  }

  static serialize(cfp: CallForProposal, opts?: { includePeriod?: boolean; includeAudits?: boolean }) {
    const period = cfp.submissionPeriod
    const data: Record<string, unknown> = {
      id: Number(cfp.id),
      title: cfp.title,
      periodKind: cfp.periodKind,
      periodLabel: cfp.periodLabel,
      deadlineAt: cfp.deadlineAt?.toISO() ?? null,
      levels: cfp.levels ?? [],
      contentHtml: cfp.contentHtml,
      attachmentUrls: cfp.attachmentUrls ?? [],
      status: cfp.status,
      createdBy: Number(cfp.createdBy),
      submittedAt: cfp.submittedAt?.toISO() ?? null,
      approvedBy: cfp.approvedBy != null ? Number(cfp.approvedBy) : null,
      approvedAt: cfp.approvedAt?.toISO() ?? null,
      returnReason: cfp.returnReason,
      publishedBy: cfp.publishedBy != null ? Number(cfp.publishedBy) : null,
      publishedAt: cfp.publishedAt?.toISO() ?? null,
      officialDocNo: cfp.officialDocNo,
      officialDocDate: cfp.officialDocDate?.toISODate?.() ?? cfp.officialDocDate ?? null,
      signedFileUrl: cfp.signedFileUrl,
      createdAt: cfp.createdAt?.toISO() ?? null,
      updatedAt: cfp.updatedAt?.toISO() ?? null,
      creatorName: cfp.creator?.fullName ?? null,
    }
    if (opts?.includePeriod && period) {
      data.submissionPeriod = {
        id: Number(period.id),
        deadlineAt: period.deadlineAt?.toISO() ?? null,
        status: period.status,
        closedAt: period.closedAt?.toISO() ?? null,
        isAccepting: period.isAcceptingNow(),
      }
    } else if (opts?.includePeriod) {
      data.submissionPeriod = null
    }
    if (opts?.includeAudits && cfp.audits) {
      data.audits = cfp.audits.map((a) => ({
        id: Number(a.id),
        action: a.action,
        note: a.note,
        actorUserId: Number(a.actorUserId),
        actorName: a.actor?.fullName ?? null,
        createdAt: a.createdAt?.toISO() ?? null,
        diffJson: a.diffJson,
      }))
    }
    return data
  }

  static async create(userId: number, payload: CfpWritePayload) {
    const deadlineAt = this.assertDeadlineMin10Days(payload.deadlineAt)
    const cfp = await CallForProposal.create({
      title: payload.title.trim(),
      periodKind: payload.periodKind,
      periodLabel: payload.periodLabel.trim(),
      deadlineAt,
      levels: payload.levels,
      contentHtml: payload.contentHtml ?? null,
      attachmentUrls: payload.attachmentUrls ?? [],
      status: 'DRAFT',
      createdBy: userId,
    })
    await this.writeAudit(cfp.id, userId, 'CREATE')
    return cfp
  }

  static async update(cfp: CallForProposal, userId: number, payload: Partial<CfpWritePayload>) {
    if (cfp.status !== 'DRAFT' && cfp.status !== 'RETURNED') {
      throw new Error('NOT_EDITABLE')
    }
    const before = {
      title: cfp.title,
      periodKind: cfp.periodKind,
      periodLabel: cfp.periodLabel,
      deadlineAt: cfp.deadlineAt.toISO(),
      levels: cfp.levels,
    }
    if (payload.title != null) cfp.title = payload.title.trim()
    if (payload.periodKind != null) cfp.periodKind = payload.periodKind
    if (payload.periodLabel != null) cfp.periodLabel = payload.periodLabel.trim()
    if (payload.deadlineAt != null) {
      cfp.deadlineAt = this.assertDeadlineMin10Days(payload.deadlineAt)
    }
    if (payload.levels != null) cfp.levels = payload.levels
    if (payload.contentHtml !== undefined) cfp.contentHtml = payload.contentHtml
    if (payload.attachmentUrls != null) cfp.attachmentUrls = payload.attachmentUrls
    await cfp.save()
    await this.writeAudit(cfp.id, userId, 'UPDATE', null, {
      before,
      after: {
        title: cfp.title,
        periodKind: cfp.periodKind,
        periodLabel: cfp.periodLabel,
        deadlineAt: cfp.deadlineAt.toISO(),
        levels: cfp.levels,
      },
    })
    return cfp
  }

  static async submit(cfp: CallForProposal, userId: number) {
    if (cfp.status !== 'DRAFT' && cfp.status !== 'RETURNED') {
      throw new Error('INVALID_STATUS')
    }
    this.assertDeadlineMin10Days(cfp.deadlineAt.toISODate()!)
    cfp.status = 'PENDING_BGH'
    cfp.submittedAt = DateTime.local()
    cfp.returnReason = null
    await cfp.save()
    await this.writeAudit(cfp.id, userId, 'SUBMIT')

    await NotificationService.pushToPermission('cfp.approve', {
      type: 'SYSTEM',
      title: 'Thông báo tuyển chọn chờ duyệt',
      message: `"${cfp.title}" đã được trình duyệt.`,
      link: LINK_DETAIL(cfp.id),
    })
    return cfp
  }

  static async approve(cfp: CallForProposal, userId: number) {
    if (cfp.status !== 'PENDING_BGH') throw new Error('INVALID_STATUS')
    cfp.status = 'APPROVED'
    cfp.approvedBy = userId
    cfp.approvedAt = DateTime.local()
    cfp.returnReason = null
    await cfp.save()
    await this.writeAudit(cfp.id, userId, 'APPROVE')

    await NotificationService.pushToPermission('cfp.publish', {
      type: 'SYSTEM',
      title: 'Thông báo tuyển chọn chờ phát hành',
      message: `"${cfp.title}" đã được BGH duyệt — cần xác nhận phát hành.`,
      link: LINK_DETAIL(cfp.id),
    })
    return cfp
  }

  static async returnToPkh(cfp: CallForProposal, userId: number, reason: string) {
    if (cfp.status !== 'PENDING_BGH') throw new Error('INVALID_STATUS')
    cfp.status = 'RETURNED'
    cfp.returnReason = reason.trim()
    await cfp.save()
    await this.writeAudit(cfp.id, userId, 'RETURN', reason.trim())

    await NotificationService.push(Number(cfp.createdBy), {
      type: 'SYSTEM',
      title: 'Thông báo tuyển chọn cần chỉnh sửa',
      message: `"${cfp.title}": ${reason.trim()}`,
      link: LINK_DETAIL(cfp.id),
    })
    return cfp
  }

  static async publish(
    cfp: CallForProposal,
    userId: number,
    data: { officialDocNo: string; officialDocDate: string; signedFileUrl?: string | null }
  ) {
    if (cfp.status !== 'APPROVED') throw new Error('INVALID_STATUS')
    const docDate = DateTime.fromISO(data.officialDocDate, { zone: 'local' })
    if (!docDate.isValid) throw new Error('INVALID_DOC_DATE')

    await db.transaction(async (trx) => {
      cfp.useTransaction(trx)
      cfp.status = 'PUBLISHED'
      cfp.publishedBy = userId
      cfp.publishedAt = DateTime.local()
      cfp.officialDocNo = data.officialDocNo.trim()
      cfp.officialDocDate = docDate.startOf('day')
      cfp.signedFileUrl = data.signedFileUrl ?? null
      await cfp.save()

      await SubmissionPeriod.create(
        {
          callForProposalId: cfp.id,
          deadlineAt: cfp.deadlineAt,
          status: 'OPEN',
        },
        { client: trx }
      )

      await CallForProposalAudit.create(
        {
          callForProposalId: cfp.id,
          actorUserId: userId,
          action: 'PUBLISH',
          note: `Số VB: ${cfp.officialDocNo}`,
        },
        { client: trx }
      )
    })

    // Gửi thông báo in-app + email SMTP (nếu đã cấu hình .env)
    void this.enqueueBroadcast(cfp).catch(() => undefined)
    return cfp
  }

  /**
   * Broadcast phát hành CFP: in-app cho staff có userId + email SMTP nếu đã cấu hình.
   */
  static async enqueueBroadcast(cfp: CallForProposal) {
    const job = await CfpEmailJob.create({
      callForProposalId: cfp.id,
      status: 'RUNNING',
      total: 0,
      sent: 0,
    })
    try {
      const staffs = await Staff.query().whereNotNull('email').select('id', 'email', 'userId', 'fullName')
      const withEmail = staffs.filter((s) => (s.email || '').trim().length > 0)
      job.total = withEmail.length
      await job.save()

      const userIds = [
        ...new Set(
          withEmail
            .map((s) => (s.userId != null ? Number(s.userId) : null))
            .filter((id): id is number => id != null && id > 0)
        ),
      ]
      if (userIds.length) {
        await NotificationService.pushMany(userIds, {
          type: 'SYSTEM',
          title: 'Thông báo tuyển chọn đề tài đã phát hành',
          message: `${cfp.title} — hạn nộp: ${cfp.deadlineAt.toFormat('dd/MM/yyyy')}`,
          link: `/projects/call-for-proposals/news/${cfp.id}`,
        })
      }

      let mailSent = 0
      let mailFailed = 0
      if (MailService.isConfigured()) {
        const subject = `[KH&CN] ${cfp.title}`
        const body = `Thông báo tuyển chọn đề tài đã phát hành.\n\n${cfp.title}\nHạn nộp: ${cfp.deadlineAt.toFormat('dd/MM/yyyy')}\nSố VB: ${cfp.officialDocNo || '—'}\n\nVui lòng đăng nhập hệ thống để xem chi tiết.`
        const seen = new Set<string>()
        for (const s of withEmail) {
          const to = String(s.email || '')
            .trim()
            .toLowerCase()
          if (!to || seen.has(to)) continue
          seen.add(to)
          const log = await EmailLogService.send({
            toEmail: to,
            subject,
            body,
            relatedType: 'call_for_proposal',
            relatedId: cfp.id,
          })
          if (log?.status === 'SENT') mailSent++
          else if (log?.status === 'FAILED') mailFailed++
        }
        job.sent = mailSent
        job.status = 'DONE'
        job.error =
          mailFailed > 0
            ? `Đã gửi ${mailSent}/${seen.size} email SMTP; thất bại ${mailFailed}. In-app: ${userIds.length} user.`
            : `Đã gửi ${mailSent} email SMTP + in-app ${userIds.length} user.`
      } else {
        job.sent = userIds.length
        job.status = 'DONE'
        job.error =
          'SMTP chưa cấu hình — chỉ gửi thông báo nội bộ. Điền SMTP_* trong .env để gửi email thật.'
      }
      await job.save()
    } catch (e) {
      job.status = 'FAILED'
      job.error = e instanceof Error ? e.message : String(e)
      await job.save()
    }
  }

  static async extend(cfp: CallForProposal, userId: number, deadlineIso: string) {
    if (cfp.status !== 'PUBLISHED') throw new Error('INVALID_STATUS')
    await cfp.load('submissionPeriod')
    const period = cfp.submissionPeriod
    if (!period || period.status !== 'OPEN') throw new Error('NO_OPEN_PERIOD')

    const newDeadline = this.parseDeadline(deadlineIso)
    if (newDeadline <= period.deadlineAt) throw new Error('DEADLINE_NOT_LATER')

    const old = period.deadlineAt.toISO()
    period.deadlineAt = newDeadline
    await period.save()
    cfp.deadlineAt = newDeadline
    await cfp.save()
    await this.writeAudit(cfp.id, userId, 'EXTEND', null, {
      before: { deadlineAt: old },
      after: { deadlineAt: newDeadline.toISO() },
    })
    return cfp
  }

  static async close(cfp: CallForProposal, userId: number) {
    if (cfp.status !== 'PUBLISHED') throw new Error('INVALID_STATUS')
    await cfp.load('submissionPeriod')
    const period = cfp.submissionPeriod
    if (!period) throw new Error('NO_PERIOD')
    if (period.status === 'CLOSED') throw new Error('ALREADY_CLOSED')

    period.status = 'CLOSED'
    period.closedAt = DateTime.local()
    period.closedBy = userId
    await period.save()
    await this.writeAudit(cfp.id, userId, 'CLOSE')
    return cfp
  }

  /**
   * Tìm kỳ OPEN còn hạn có levels chứa `level`.
   * Dùng để khóa nộp đề xuất.
   */
  static async findActivePeriodForLevel(level: ProjectProposalLevel) {
    const now = DateTime.local()
    const periods = await SubmissionPeriod.query()
      .where('status', 'OPEN')
      .where('deadline_at', '>=', now.startOf('day').toSQL()!)
      .preload('callForProposal')

    for (const p of periods) {
      const cfp = p.callForProposal
      if (!cfp || cfp.status !== 'PUBLISHED') continue
      const levels = cfp.levels || []
      if (levels.includes(level)) {
        return { period: p, callForProposal: cfp }
      }
    }
    return null
  }

  /** User chỉ có view (không quản lý): chỉ thấy PUBLISHED */
  static async listForUser(
    userId: number,
    filters: { status?: string; periodLabel?: string; keyword?: string }
  ) {
    const canManage = await this.userCanManageList(userId)
    const q = CallForProposal.query().preload('creator').orderBy('id', 'desc')
    if (!canManage) {
      q.where('status', 'PUBLISHED')
    } else if (filters.status) {
      q.where('status', filters.status as CfpStatus)
    }
    if (filters.periodLabel) q.where('period_label', filters.periodLabel)
    const kw = (filters.keyword || '').trim()
    if (kw) q.whereILike('title', `%${kw}%`)
    return q
  }

  static async userCanManageList(userId: number): Promise<boolean> {
    const codes = [
      'cfp.create',
      'cfp.update',
      'cfp.submit',
      'cfp.approve',
      'cfp.publish',
      'cfp.extend',
      'cfp.close',
    ]
    for (const c of codes) {
      if (await PermissionService.userHasPermission(userId, c)) return true
    }
    return false
  }
}
