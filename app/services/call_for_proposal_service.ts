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
import EmailLog from '#models/email_log'
import EmailLogService from '#services/email_log_service'
import MailService from '#services/mail_service'
import { enqueueCfpEmailBroadcast } from '#queues/cfp_email_queue'
import ProjectProposal from '#models/project_proposal'
import type { ProjectProposalLevel } from '#models/project_proposal'
import ProjectProcessType from '#models/project_process_type'
import { levelFromProcessTypeCode } from '#utils/project_process_type_level'
import ContractTemplateService from '#services/contract_template_service'
import { findContractTemplateFilePath } from '#utils/contract_template_storage'
import {
  chenBangNhiemVu,
  chenNoiDungHtml,
  DAU_BANG_NHIEM_VU,
  DAU_NOI_DUNG,
  renderDocxBuffer,
} from '#utils/docx_merge_helper'
import type { HangBangNhiemVu } from '#utils/docx_merge_helper'
import {
  extractPreviewTextFromDocumentXml,
  readDocxDocumentXml,
} from '#utils/docx_placeholder_helper'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const LINK_LIST = '/projects/call-for-proposals'
const LINK_DETAIL = (id: number) => `/projects/call-for-proposals/${id}`

export type CfpWritePayload = {
  title: string
  periodKind: CfpPeriodKind
  periodLabel: string
  deadlineAt: string
  /** Chọn từ danh mục loại quy trình đề tài */
  projectProcessTypeIds?: number[]
  /** Legacy — suy từ QT nếu không gửi ids */
  levels?: ProjectProposalLevel[]
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

  /**
   * Resolve danh mục QT ACTIVE → ids + levels suy ra.
   * Bắt buộc có ít nhất 1 loại hợp lệ.
   */
  static async resolveProcessTypesAndLevels(payload: {
    projectProcessTypeIds?: number[]
    levels?: ProjectProposalLevel[]
  }): Promise<{ projectProcessTypeIds: number[]; levels: ProjectProposalLevel[] }> {
    const rawIds = [...new Set((payload.projectProcessTypeIds || []).map(Number).filter((n) => n > 0))]
    if (rawIds.length) {
      const rows = await ProjectProcessType.query()
        .whereIn('id', rawIds)
        .where('status', 'ACTIVE')
      if (rows.length !== rawIds.length) {
        throw new Error('INVALID_PROCESS_TYPES')
      }
      const levels = [
        ...new Set(rows.map((r) => levelFromProcessTypeCode(r.code))),
      ] as ProjectProposalLevel[]
      return { projectProcessTypeIds: rawIds, levels }
    }
    if (payload.levels?.length) {
      return { projectProcessTypeIds: [], levels: payload.levels }
    }
    throw new Error('MISSING_LEVELS')
  }

  static async serialize(
    cfp: CallForProposal,
    opts?: { includePeriod?: boolean; includeAudits?: boolean }
  ) {
    const period = cfp.submissionPeriod
    const typeIds = cfp.projectProcessTypeIds ?? []
    let projectProcessTypes: Array<{ id: number; code: string; name: string }> = []
    if (typeIds.length) {
      const rows = await ProjectProcessType.query().whereIn('id', typeIds).orderBy('display_order', 'asc')
      projectProcessTypes = rows.map((r) => ({
        id: Number(r.id),
        code: r.code,
        name: r.name,
      }))
    }

    const data: Record<string, unknown> = {
      id: Number(cfp.id),
      title: cfp.title,
      periodKind: cfp.periodKind,
      periodLabel: cfp.periodLabel,
      deadlineAt: cfp.deadlineAt?.toISO() ?? null,
      levels: cfp.levels ?? [],
      projectProcessTypeIds: typeIds,
      projectProcessTypes,
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
    const resolved = await this.resolveProcessTypesAndLevels(payload)
    const cfp = await CallForProposal.create({
      title: payload.title.trim(),
      periodKind: payload.periodKind,
      periodLabel: payload.periodLabel.trim(),
      deadlineAt,
      levels: resolved.levels,
      projectProcessTypeIds: resolved.projectProcessTypeIds,
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
      projectProcessTypeIds: cfp.projectProcessTypeIds,
    }
    if (payload.title != null) cfp.title = payload.title.trim()
    if (payload.periodKind != null) cfp.periodKind = payload.periodKind
    if (payload.periodLabel != null) cfp.periodLabel = payload.periodLabel.trim()
    if (payload.deadlineAt != null) {
      cfp.deadlineAt = this.assertDeadlineMin10Days(payload.deadlineAt)
    }
    if (payload.projectProcessTypeIds != null || payload.levels != null) {
      const resolved = await this.resolveProcessTypesAndLevels({
        projectProcessTypeIds: payload.projectProcessTypeIds,
        levels: payload.levels,
      })
      cfp.projectProcessTypeIds = resolved.projectProcessTypeIds
      cfp.levels = resolved.levels
    }
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
        projectProcessTypeIds: cfp.projectProcessTypeIds,
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
    let soMoi = ''
    await db.transaction(async (trx) => {
      soMoi = await ContractTemplateService.capSoThongBaoDaDuyet(trx)
      cfp.useTransaction(trx)
      cfp.status = 'APPROVED'
      cfp.approvedBy = userId
      cfp.approvedAt = DateTime.local()
      cfp.returnReason = null
      cfp.officialDocNo = soMoi
      await cfp.save()
    })
    await this.writeAudit(cfp.id, userId, 'APPROVE', `Số thông báo: ${soMoi}`)

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

    // Gửi mail theo cấu hình QUEUE / SYNC (.env)
    void this.dispatchBroadcast(cfp).catch(() => undefined)
    return cfp
  }

  /** Bật đẩy BullMQ? Mặc định true nếu chưa set (giữ hành vi cũ). */
  static isCfpEmailQueueEnabled(): boolean {
    const v = env.get('CFP_EMAIL_QUEUE_ENABLED')
    return v === undefined || v === null ? true : v === true
  }

  /** Bật gửi đồng bộ trong process API (cách cũ)? Mặc định false. */
  static isCfpEmailSyncEnabled(): boolean {
    return env.get('CFP_EMAIL_SYNC_ENABLED') === true
  }

  /**
   * Phát sóng mail CFP theo 2 chế độ (.env):
   * - CFP_EMAIL_QUEUE_ENABLED: đẩy Redis/BullMQ → worker gửi
   * - CFP_EMAIL_SYNC_ENABLED: gọi enqueueBroadcast ngay trong API (không cần Redis)
   * Cả hai bật: ưu tiên queue; queue lỗi thì fallback sync nếu SYNC bật.
   */
  static async dispatchBroadcast(cfp: CallForProposal, opts?: { resumeJobId?: number }) {
    const useQueue = this.isCfpEmailQueueEnabled()
    const useSync = this.isCfpEmailSyncEnabled()

    if (!useQueue && !useSync) {
      await CfpEmailJob.create({
        callForProposalId: cfp.id,
        status: 'FAILED',
        total: 0,
        sent: 0,
        error:
          'Chưa bật chế độ gửi mail CFP. Đặt CFP_EMAIL_QUEUE_ENABLED=true và/hoặc CFP_EMAIL_SYNC_ENABLED=true.',
      })
      throw new Error('CFP_EMAIL_DISPATCH_DISABLED')
    }

    if (useQueue) {
      try {
        return await enqueueCfpEmailBroadcast({
          cfpId: Number(cfp.id),
          resumeJobId: opts?.resumeJobId ?? null,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (useSync) {
          // Redis/BullMQ lỗi → fallback cách cũ trong process API
          void this.enqueueBroadcast(cfp, opts).catch(() => undefined)
          return null
        }
        await CfpEmailJob.create({
          callForProposalId: cfp.id,
          status: 'FAILED',
          total: 0,
          sent: 0,
          error: `Không đẩy BullMQ (cần Redis + worker). Bật CFP_EMAIL_SYNC_ENABLED=true để gửi cách cũ: ${msg}`,
        })
        throw e
      }
    }

    // Chỉ SYNC: gửi ngay trong process (fire-and-forget — không chặn HTTP quá lâu nếu gọi void bên ngoài)
    void this.enqueueBroadcast(cfp, opts).catch(() => undefined)
    return null
  }

  /**
   * Broadcast phát hành CFP: in-app + email SMTP tới staffs.email.
   * Chạy trong worker BullMQ. Hỗ trợ resume: bỏ qua email đã SENT.
   */
  static async enqueueBroadcast(cfp: CallForProposal, opts?: { resumeJobId?: number }) {
    let job =
      opts?.resumeJobId != null
        ? await CfpEmailJob.find(opts.resumeJobId)
        : null
    if (!job) {
      job = await CfpEmailJob.create({
        callForProposalId: cfp.id,
        status: 'RUNNING',
        total: 0,
        sent: 0,
      })
    } else {
      job.status = 'RUNNING'
      job.error = null
      await job.save()
    }

    try {
      // Ưu tiên id tăng dần — mail mới (vd Gmail test) thường ở cuối, không được kẹt giữa chừng
      const staffs = await Staff.query()
        .whereNotNull('email')
        .select('id', 'email', 'userId', 'fullName')
        .orderBy('id', 'asc')
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
      // Chỉ push in-app lần đầu (không resume)
      if (!opts?.resumeJobId && userIds.length) {
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

        // Email đã gửi thành công trước đó — bỏ qua khi resume
        const alreadySent = await EmailLog.query()
          .where('related_type', 'call_for_proposal')
          .where('related_id', cfp.id)
          .where('status', 'SENT')
          .select('to_email')
        const doneSet = new Set(
          alreadySent.map((r) => String(r.toEmail || '').trim().toLowerCase()).filter(Boolean)
        )
        mailSent = doneSet.size

        // Đánh dấu log PENDING treo → FAILED để không nhầm trạng thái
        await EmailLog.query()
          .where('related_type', 'call_for_proposal')
          .where('related_id', cfp.id)
          .where('status', 'PENDING')
          .update({
            status: 'FAILED',
            error_message: 'SMTP treo / bị gián đoạn — đánh dấu FAILED để gửi lại.',
          })

        const seen = new Set<string>(doneSet)
        let processed = 0
        for (const s of withEmail) {
          const to = String(s.email || '')
            .trim()
            .toLowerCase()
          if (!to || seen.has(to)) continue
          seen.add(to)
          try {
            const log = await EmailLogService.send({
              toEmail: to,
              subject,
              body,
              relatedType: 'call_for_proposal',
              relatedId: cfp.id,
            })
            if (log?.status === 'SENT') mailSent++
            else mailFailed++
          } catch {
            mailFailed++
          }
          processed++
          // Cập nhật tiến độ định kỳ — UI/DB biết job còn sống
          if (processed % 10 === 0) {
            job.sent = mailSent
            job.error = `Đang gửi… ${mailSent} OK, ${mailFailed} lỗi (đã bỏ qua ${doneSet.size} đã gửi).`
            await job.save()
          }
        }
        job.sent = mailSent
        job.status = 'DONE'
        job.error =
          mailFailed > 0
            ? `Đã gửi ${mailSent} email SMTP; thất bại ${mailFailed}; bỏ qua đã gửi ${doneSet.size}. In-app: ${userIds.length} user.`
            : `Đã gửi ${mailSent} email SMTP + in-app ${userIds.length} user.`
      } else {
        job.sent = userIds.length
        job.status = 'DONE'
        job.error = MailService.isEnabledFlag()
          ? 'SMTP thiếu HOST/USER/PASSWORD — chỉ thông báo nội bộ.'
          : 'SMTP_ENABLED≠true (kiểm thử) — không gửi email; chỉ thông báo nội bộ. Bật SMTP_ENABLED=true để gửi thật.'
      }
      await job.save()
    } catch (e) {
      job.status = 'FAILED'
      job.error = e instanceof Error ? e.message : String(e)
      await job.save()
    }
  }

  /** Tiếp tục / gửi lại theo QUEUE hoặc SYNC (bỏ qua mail đã SENT). */
  static async resumeBroadcast(cfpId: number) {
    const cfp = await CallForProposal.find(cfpId)
    if (!cfp || cfp.status !== 'PUBLISHED') throw new Error('CFP_NOT_PUBLISHED')
    const job = await CfpEmailJob.query()
      .where('call_for_proposal_id', cfpId)
      .orderBy('id', 'desc')
      .first()
    await this.dispatchBroadcast(cfp, { resumeJobId: job?.id })
    return job
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
   * Tìm kỳ OPEN còn hạn khớp loại quy trình / cấp đề tài.
   */
  static async findActivePeriodForLevel(
    level: ProjectProposalLevel,
    projectProcessTypeId?: number | null
  ) {
    const now = DateTime.local()
    const periods = await SubmissionPeriod.query()
      .where('status', 'OPEN')
      .where('deadline_at', '>=', now.startOf('day').toSQL()!)
      .preload('callForProposal')

    for (const p of periods) {
      const cfp = p.callForProposal
      if (!cfp || cfp.status !== 'PUBLISHED') continue
      const typeIds = cfp.projectProcessTypeIds || []
      if (projectProcessTypeId && typeIds.length) {
        if (typeIds.includes(Number(projectProcessTypeId))) {
          return { period: p, callForProposal: cfp }
        }
        continue
      }
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

  /** Mã QT của các cấp thông báo đang chọn */
  private static async maQtCuaThongBao(cfp: CallForProposal) {
    const ids = (cfp.projectProcessTypeIds || [])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (!ids.length) return { ids: [] as number[], codes: [] as string[] }
    const rows = await ProjectProcessType.query().whereIn('id', ids).select('id', 'code')
    return { ids, codes: rows.map((r) => r.code).filter(Boolean) }
  }

  /** Nhiệm vụ khớp cấp khi cấp chính hoặc một cấp phù hợp nằm trong thông báo */
  private static nhiemVuKhopCap(
    p: ProjectProposal,
    qtIds: number[],
    codes: string[]
  ): boolean {
    if (!qtIds.length && !codes.length) return true
    if (p.projectProcessTypeId != null && qtIds.includes(Number(p.projectProcessTypeId))) {
      return true
    }
    return (p.suitableLevels || []).some((code) => codes.includes(code))
  }

  private static tomTatNhiemVu(p: ProjectProposal, tieuDeThongBao: string | null) {
    const ppt = p.projectProcessType
    return {
      id: Number(p.id),
      code: p.code,
      title: p.title,
      ownerName: p.ownerName,
      ownerUnit: p.ownerUnit,
      status: p.status,
      projectProcessType: ppt
        ? { id: Number(ppt.id), code: ppt.code, name: ppt.name }
        : null,
      callForProposalId: p.callForProposalId != null ? Number(p.callForProposalId) : null,
      callForProposalTitle: tieuDeThongBao,
    }
  }

  /** Nhiệm vụ đang gắn với thông báo */
  static async danhSachNhiemVu(cfp: CallForProposal) {
    const rows = await ProjectProposal.query()
      .where('call_for_proposal_id', cfp.id)
      .preload('projectProcessType')
      .orderBy('code', 'asc')
    return rows.map((p) => this.tomTatNhiemVu(p, null))
  }

  /**
   * Nhiệm vụ chưa gắn thông báo này, cùng cấp, để chọn thêm.
   * Vẫn hiện nhiệm vụ đang thuộc thông báo khác để người dùng chuyển sang.
   */
  static async ungVienNhiemVu(
    cfp: CallForProposal,
    params: { page: number; perPage: number; keyword: string }
  ) {
    const { ids, codes } = await this.maQtCuaThongBao(cfp)
    return this.truyVanUngVien(ids, codes, { ...params, excludeCfpId: Number(cfp.id) })
  }

  /** Danh sách nhiệm vụ theo cấp đang chọn trên form tạo (chưa có id thông báo) */
  static async ungVienTheoLoaiQuyTrinh(
    qtIds: number[],
    params: { page: number; perPage: number; keyword: string }
  ) {
    const ids = [...new Set(qtIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))]
    if (!ids.length) {
      return {
        data: [],
        meta: { total: 0, currentPage: 1, perPage: params.perPage, lastPage: 1 },
      }
    }
    const rows = await ProjectProcessType.query().whereIn('id', ids).select('id', 'code')
    return this.truyVanUngVien(
      rows.map((r) => Number(r.id)),
      rows.map((r) => r.code).filter(Boolean),
      { ...params, excludeCfpId: null }
    )
  }

  private static async truyVanUngVien(
    ids: number[],
    codes: string[],
    params: { page: number; perPage: number; keyword: string; excludeCfpId: number | null }
  ) {
    const q = ProjectProposal.query().preload('projectProcessType').orderBy('updated_at', 'desc')
    if (params.excludeCfpId != null) {
      q.where((b) => {
        b.whereNull('call_for_proposal_id').orWhereNot('call_for_proposal_id', params.excludeCfpId!)
      })
    }

    const kw = params.keyword.trim()
    if (kw) {
      q.where((b) => {
        b.whereILike('code', `%${kw}%`)
          .orWhereILike('title', `%${kw}%`)
          .orWhereILike('owner_name', `%${kw}%`)
      })
    }
    if (ids.length || codes.length) {
      const sqlCap = `EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(COALESCE(suitable_levels, '[]'::jsonb)) AS lv
              WHERE lv = ANY(?::text[])
            )`
      q.where((b) => {
        if (ids.length && codes.length) {
          b.whereIn('project_process_type_id', ids).orWhereRaw(sqlCap, [codes])
        } else if (ids.length) {
          b.whereIn('project_process_type_id', ids)
        } else {
          b.whereRaw(sqlCap, [codes])
        }
      })
    }

    const paginated = await q.paginate(params.page, params.perPage)
    const cfpIds = [
      ...new Set(
        paginated
          .all()
          .map((p) => (p.callForProposalId != null ? Number(p.callForProposalId) : 0))
          .filter((id) => id > 0)
      ),
    ]
    const tieuDe = new Map<number, string>()
    if (cfpIds.length) {
      const khac = await CallForProposal.query().whereIn('id', cfpIds).select('id', 'title')
      for (const row of khac) tieuDe.set(Number(row.id), row.title)
    }

    return {
      data: paginated.all().map((p) =>
        this.tomTatNhiemVu(
          p,
          p.callForProposalId != null ? tieuDe.get(Number(p.callForProposalId)) ?? null : null
        )
      ),
      meta: {
        total: paginated.total,
        currentPage: paginated.currentPage,
        perPage: paginated.perPage,
        lastPage: paginated.lastPage,
      },
    }
  }

  private static assertSuaNhiemVu(cfp: CallForProposal) {
    if (cfp.status !== 'DRAFT' && cfp.status !== 'RETURNED') {
      return 'Chỉ thêm hoặc gỡ nhiệm vụ khi thông báo còn nháp hoặc bị trả về.'
    }
    return null
  }

  /** Gắn nhiệm vụ vào thông báo. Nhiệm vụ đang thuộc thông báo khác sẽ được chuyển sang. */
  static async ganNhiemVu(cfp: CallForProposal, userId: number, proposalIds: number[]) {
    const chan = this.assertSuaNhiemVu(cfp)
    if (chan) return { ok: false as const, message: chan }

    const ids = [...new Set(proposalIds.map((id) => Number(id)).filter((id) => id > 0))]
    const rows = await ProjectProposal.query().whereIn('id', ids).preload('projectProcessType')
    if (rows.length !== ids.length) {
      return { ok: false as const, message: 'Có nhiệm vụ không còn trong danh sách đề xuất.' }
    }

    const { ids: qtIds, codes } = await this.maQtCuaThongBao(cfp)
    const lechCap = rows.filter((p) => !this.nhiemVuKhopCap(p, qtIds, codes))
    if (lechCap.length) {
      const ten = lechCap
        .slice(0, 3)
        .map((p) => p.code)
        .join(', ')
      return {
        ok: false as const,
        message: `Nhiệm vụ ${ten} không cùng cấp với thông báo này.`,
      }
    }

    let moved = 0
    for (const p of rows) {
      if (p.callForProposalId != null && Number(p.callForProposalId) !== Number(cfp.id)) {
        moved += 1
      }
      p.callForProposalId = cfp.id
      await p.save()
    }

    await this.writeAudit(
      cfp.id,
      userId,
      'UPDATE',
      `Gắn ${rows.length} nhiệm vụ vào thông báo.`,
      { proposalIds: ids, moved }
    )
    return { ok: true as const, attached: rows.length, moved }
  }

  /** Gỡ nhiệm vụ đang thuộc thông báo này */
  static async goNhiemVu(cfp: CallForProposal, userId: number, proposalIds: number[]) {
    const chan = this.assertSuaNhiemVu(cfp)
    if (chan) return { ok: false as const, message: chan }

    const ids = [...new Set(proposalIds.map((id) => Number(id)).filter((id) => id > 0))]
    const rows = await ProjectProposal.query()
      .whereIn('id', ids)
      .where('call_for_proposal_id', cfp.id)
    if (!rows.length) {
      return { ok: false as const, message: 'Không có nhiệm vụ nào thuộc thông báo này.' }
    }
    for (const p of rows) {
      p.callForProposalId = null
      await p.save()
    }
    await this.writeAudit(cfp.id, userId, 'UPDATE', `Gỡ ${rows.length} nhiệm vụ khỏi thông báo.`, {
      proposalIds: rows.map((p) => Number(p.id)),
    })
    return { ok: true as const, removed: rows.length }
  }

  /**
   * Tách số và ký hiệu. Số đã lưu dạng 12/TB-ĐHSP thì không ghép ký hiệu thêm lần nữa.
   */
  private static tachSoKyHieu(officialDocNo: string | null, kyHieuMau: string, soDuPhong: string) {
    const raw = (officialDocNo || '').trim()
    const kyMau = kyHieuMau.trim()
    if (!raw) {
      return { so: soDuPhong, kyHieu: kyMau, dayDu: kyMau ? `${soDuPhong}/${kyMau}` : soDuPhong }
    }
    const cat = raw.indexOf('/')
    if (cat > 0) {
      const so = raw.slice(0, cat)
      const kyHieu = raw.slice(cat + 1) || kyMau
      return { so, kyHieu, dayDu: kyHieu ? `${so}/${kyHieu}` : so }
    }
    return { so: raw, kyHieu: kyMau, dayDu: kyMau ? `${raw}/${kyMau}` : raw }
  }

  /** Số hiện trên thông báo: số đã cấp, hoặc số mới nhất + 1 khi chưa phê duyệt. */
  static async soVanBanHienThi(cfp: CallForProposal) {
    const mau = await ContractTemplateService.getDefaultActive('THONG_BAO')
    const cauHinh = mau?.mergeConfig
    const soDuPhong = String((cauHinh?.so_moi_nhat || 0) + 1)
    return this.tachSoKyHieu(cfp.officialDocNo, cauHinh?.ky_hieu || '', soDuPhong).dayDu
  }

  /** Dữ liệu đổ vào mẫu DOCX thông báo tuyển chọn */
  private static async duLieuMauThongBao(cfp: CallForProposal): Promise<{
    bien: Record<string, string>
    hang: HangBangNhiemVu[]
  }> {
    const nhiemVu = await ProjectProposal.query()
      .where('call_for_proposal_id', cfp.id)
      .orderBy('code', 'asc')
    const hang: HangBangNhiemVu[] = nhiemVu.map((p, i) => ({
      stt: String(i + 1),
      tenNhiemVu: p.title || '',
      mucTieu: (p.objectives || '').trim(),
      sanPhamDuKien: (p.expectedResults || '').trim(),
      thoiGianThucHien: p.durationMonths ? `${p.durationMonths} tháng` : '',
    }))

    // Đã phát hành thì dd/mm/yyyy lấy ngày phát hành. Trước đó vẫn là ngày hiện tại.
    const ngayPhatHanh =
      cfp.status === 'PUBLISHED' && cfp.officialDocDate?.isValid ? cfp.officialDocDate : null
    const ngayBien = ngayPhatHanh || DateTime.now()
    const mau = await ContractTemplateService.getDefaultActive('THONG_BAO')
    const cauHinh = mau?.mergeConfig
    const tach = this.tachSoKyHieu(
      cfp.officialDocNo,
      cauHinh?.ky_hieu || '',
      String((cauHinh?.so_moi_nhat || 0) + 1)
    )
    return {
      hang,
      bien: {
        so: tach.so,
        ky_hieu: tach.kyHieu,
        dd: ngayBien.toFormat('dd'),
        mm: ngayBien.toFormat('MM'),
        year: ngayBien.toFormat('yyyy'),
        yyyy: ngayBien.toFormat('yyyy'),
        tieu_de: cfp.title || '',
        noi_dung_thong_bao: DAU_NOI_DUNG,
        tham_quyen_ky: cauHinh?.tham_quyen_ky || '',
        ho_ten_nguoi_ky: cauHinh?.ho_ten_nguoi_ky || '',
        noi_nhan: cauHinh?.noi_nhan || '',
        nam_thuc_hien: cfp.periodLabel || '',
        danh_sach_nhiem_vu: DAU_BANG_NHIEM_VU,
      },
    }
  }

  /** Dữ liệu để dựng trang HTML xem thông báo */
  static async duLieuXemThongBao(cfp: CallForProposal) {
    const { bien, hang } = await this.duLieuMauThongBao(cfp)
    const truong = { ...bien }
    delete truong.danh_sach_nhiem_vu
    truong.noi_dung_thong_bao = cfp.contentHtml || ''
    return {
      id: Number(cfp.id),
      status: cfp.status,
      truong,
      hang,
    }
  }

  /** Đổ mẫu thông báo mặc định thành file DOCX */
  static async renderMauThongBao(cfp: CallForProposal) {
    const template = await ContractTemplateService.getDefaultActive('THONG_BAO')
    if (!template) throw new Error('NO_DEFAULT_TEMPLATE')
    const templatePath = await findContractTemplateFilePath(template.storedFileName)
    if (!templatePath) throw new Error('TEMPLATE_FILE_MISSING')
    const { bien, hang } = await this.duLieuMauThongBao(cfp)
    let buffer: Buffer
    try {
      buffer = chenNoiDungHtml(await renderDocxBuffer(templatePath, bien), cfp.contentHtml || '')
      buffer = chenBangNhiemVu(buffer, hang)
    } catch (e) {
      if (e instanceof Error && e.message === 'TEMPLATE_RENDER_FAILED') throw e
      throw new Error('TEMPLATE_RENDER_FAILED')
    }
    return { buffer, fileName: 'Thong-bao-tuyen-chon.docx' }
  }

  /** Nội dung chữ của file đã đổ, để xem trên màn hình */
  static async xemTruocThongBao(cfp: CallForProposal) {
    const { buffer } = await this.renderMauThongBao(cfp)
    const tmp = path.join(os.tmpdir(), `tb-${randomUUID()}.docx`)
    await fs.writeFile(tmp, buffer)
    try {
      const xml = await readDocxDocumentXml(tmp)
      return extractPreviewTextFromDocumentXml(xml)
    } finally {
      await fs.unlink(tmp).catch(() => undefined)
    }
  }
}
