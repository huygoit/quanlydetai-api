import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectProgressPeriod from '#models/project_progress_period'
import ProjectProgressReport from '#models/project_progress_report'
import type { ProgressContentRow, ProgressProductRow } from '#models/project_progress_report'
import { FILE_LIMIT, PROGRESS_REMIND_DAYS, type BctdStatus } from '#constants/module56'
import EmailLogService from '#services/email_log_service'
import NotificationService from '#services/notification_service'
import {
  assertCnnv,
  assertExecution,
  assertPerm,
  assertReady,
  budgetSnapshot,
  hasPerm,
  isCnnv,
  iso,
  loadOutline,
  parseFiles,
  today,
} from '#services/module56_common'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

function dueFromMilestone(raw: string | null | undefined, fallback: DateTime | null) {
  if (raw) {
    const d = DateTime.fromISO(raw)
    if (d.isValid) return d.startOf('day')
  }
  return fallback
}

/**
 * Kỳ báo cáo BM.08 và phiếu nộp (QD-10).
 */
export default class ProjectProgressService {
  static async ensurePeriods(outline: ProjectOutline, trx?: TransactionClientContract) {
    const q = ProjectProgressPeriod.query()
    if (trx) q.useTransaction(trx)
    const existed = await q.where('project_outline_id', outline.id).first()
    if (existed) return

    const milestones = outline.milestones || []
    const rows: {
      projectOutlineId: number
      title: string
      dueOn: DateTime
      kind: 'MILESTONE' | 'MIDPOINT'
      sourceIndex: number | null
      remindedDays: number[]
    }[] = []

    if (milestones.length) {
      milestones.forEach((m, index) => {
        const due = dueFromMilestone(m.endDate, outline.endDate)
        if (!due) return
        rows.push({
          projectOutlineId: outline.id,
          title: m.content || `Mốc ${index + 1}`,
          dueOn: due,
          kind: 'MILESTONE',
          sourceIndex: index,
          remindedDays: [],
        })
      })
    }

    if (!rows.length && outline.startDate && outline.endDate) {
      const ms = outline.endDate.diff(outline.startDate).milliseconds / 2
      rows.push({
        projectOutlineId: outline.id,
        title: 'Báo cáo giữa kỳ',
        dueOn: outline.startDate.plus({ milliseconds: ms }).startOf('day'),
        kind: 'MIDPOINT',
        sourceIndex: null,
        remindedDays: [],
      })
    } else if (!rows.length && outline.endDate) {
      rows.push({
        projectOutlineId: outline.id,
        title: 'Báo cáo cuối kỳ thực hiện',
        dueOn: outline.endDate.startOf('day'),
        kind: 'MIDPOINT',
        sourceIndex: null,
        remindedDays: [],
      })
    }

    if (!rows.length) return
    await ProjectProgressPeriod.createMany(rows, trx ? { client: trx } : undefined)
  }

  /** Gia hạn: tính lại mốc giữa kỳ; mốc thuyết minh lấy ngày kết thúc mới nếu phiếu có mốc mới. */
  static async refreshAfterAdjustment(outline: ProjectOutline) {
    const periods = await ProjectProgressPeriod.query().where('project_outline_id', outline.id)
    const milestones = outline.milestones || []
    for (const period of periods) {
      if (period.kind === 'MIDPOINT' && outline.startDate && outline.endDate) {
        const ms = outline.endDate.diff(outline.startDate).milliseconds / 2
        period.dueOn = outline.startDate.plus({ milliseconds: ms }).startOf('day')
        await period.save()
      }
      if (period.kind === 'MILESTONE' && period.sourceIndex != null) {
        const m = milestones[period.sourceIndex]
        const due = dueFromMilestone(m?.endDate, null)
        if (due) {
          period.dueOn = due
          if (m?.content) period.title = m.content
          await period.save()
        }
      }
    }
  }

  static async list(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    await this.assertViewer(userId, outline)
    const periods = await ProjectProgressPeriod.query()
      .where('project_outline_id', outlineId)
      .orderBy('due_on', 'asc')
    const reports = await ProjectProgressReport.query().where('project_outline_id', outlineId)
    const finance = await budgetSnapshot(outlineId)
    const now = today()
    return {
      finance: {
        advanced: finance.reduce((s, l) => s + l.advanced, 0),
        spent: finance.reduce((s, l) => s + l.spent, 0),
        settled: finance.reduce((s, l) => s + l.settled, 0),
        lines: finance,
      },
      periods: periods.map((p) => {
        const report = reports.find((r) => r.periodId === p.id) || null
        const overdue = p.dueOn.startOf('day') < now && report?.status !== 'BCTD_DONE'
        return {
          id: p.id,
          title: p.title,
          dueOn: p.dueOn.toISODate(),
          kind: p.kind,
          overdue,
          report: report ? this.serializeReport(report) : null,
        }
      }),
    }
  }

  static serializeReport(row: ProjectProgressReport) {
    return {
      id: row.id,
      periodId: row.periodId,
      projectOutlineId: row.projectOutlineId,
      status: row.status,
      contentRows: row.contentRows || [],
      productRows: row.productRows || [],
      nextPlan: row.nextPlan,
      recommendation: row.recommendation,
      attachments: row.attachments || [],
      version: row.version,
      pkhNote: row.pkhNote,
      submittedAt: iso(row.submittedAt),
      updatedAt: iso(row.updatedAt),
    }
  }

  private static async assertViewer(userId: number, outline: ProjectOutline) {
    if (await isCnnv(userId, outline)) return
    if (
      (await hasPerm(userId, 'project.contract_manage')) ||
      (await hasPerm(userId, 'project.view')) ||
      (await hasPerm(userId, 'project.budget_confirm'))
    ) {
      return
    }
    throw new Error('FORBIDDEN')
  }

  static async save(
    outlineId: number,
    periodId: number,
    userId: number,
    body: Record<string, unknown>,
    submit: boolean
  ) {
    const outline = await loadOutline(outlineId)
    assertReady(outline)
    assertExecution(outline, ['DANG_THUC_HIEN'])
    await assertCnnv(userId, outline)

    const period = await ProjectProgressPeriod.query()
      .where('id', periodId)
      .where('project_outline_id', outlineId)
      .first()
    if (!period) throw new Error('PERIOD_NOT_FOUND')

    let report = await ProjectProgressReport.query().where('period_id', periodId).first()
    if (report && !['BCTD_DRAFT', 'BCTD_BS'].includes(report.status)) {
      throw new Error('REPORT_LOCKED')
    }

    const contentRows = this.contentRows(outline, body.contentRows)
    const productRows = this.productRows(outline, body.productRows)
    const nextPlan = String(body.nextPlan ?? body.next_plan ?? '').trim()
    const recommendation = String(body.recommendation ?? '').trim() || null
    const attachments = parseFiles(body.attachments, { maxTotal: FILE_LIMIT.progressTotal })

    if (submit && !nextPlan) throw new Error('NEXT_PLAN_REQUIRED')

    if (!report) {
      report = await ProjectProgressReport.create({
        periodId,
        projectOutlineId: outlineId,
        status: 'BCTD_DRAFT',
        contentRows,
        productRows,
        nextPlan,
        recommendation,
        attachments,
        version: 1,
      })
    } else {
      report.contentRows = contentRows
      report.productRows = productRows
      report.nextPlan = nextPlan
      report.recommendation = recommendation
      report.attachments = attachments
      report.version = (report.version || 1) + 1
    }

    if (submit) {
      report.status = 'BCTD_CHO_PKH'
      report.submittedAt = DateTime.now()
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Báo cáo tiến độ chờ ghi nhận',
        message: `${outline.code}: ${period.title}`,
        link: `/projects/progress/${outline.id}`,
      })
    }
    await report.save()
    return this.serializeReport(report)
  }

  static async pkhAction(reportId: number, userId: number, accept: boolean, note: string) {
    await assertPerm(userId, 'project.contract_manage')
    const report = await ProjectProgressReport.find(reportId)
    if (!report || report.status !== 'BCTD_CHO_PKH') throw new Error('BAD_STATUS')
    const outline = await loadOutline(report.projectOutlineId)
    report.pkhNote = note || null
    report.status = (accept ? 'BCTD_DONE' : 'BCTD_BS') as BctdStatus
    await report.save()
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: accept ? 'Báo cáo tiến độ đã được ghi nhận' : 'Báo cáo tiến độ cần bổ sung',
        message: `${outline.code}${note ? `: ${note}` : ''}`,
        link: `/projects/progress/${outline.id}`,
      })
    }
    return this.serializeReport(report)
  }

  /** Nhắc 30/14/7/3 ngày trước hạn. Gọi từ ace remind:module56. */
  static async sendReminders() {
    const periods = await ProjectProgressPeriod.query()
    const now = today()
    let sent = 0
    for (const period of periods) {
      const daysLeft = Math.round(period.dueOn.startOf('day').diff(now, 'days').days)
      if (!PROGRESS_REMIND_DAYS.includes(daysLeft as (typeof PROGRESS_REMIND_DAYS)[number])) continue
      const reminded = period.remindedDays || []
      if (reminded.includes(daysLeft)) continue
      const report = await ProjectProgressReport.query().where('period_id', period.id).first()
      if (report?.status === 'BCTD_DONE') continue
      const outline = await ProjectOutline.find(period.projectOutlineId)
      if (!outline?.ownerId || outline.executionStatus !== 'DANG_THUC_HIEN') continue
      const subject = `Nhắc báo cáo tiến độ còn ${daysLeft} ngày`
      const body = `${outline.code} — ${period.title}, hạn ${period.dueOn.toFormat('dd/MM/yyyy')}.`
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: subject,
        message: body,
        link: `/projects/progress/${outline.id}`,
      })
      await EmailLogService.logStubToUser(outline.ownerId, subject, body, 'progress_period', period.id)
      period.remindedDays = [...reminded, daysLeft]
      await period.save()
      sent += 1
    }
    return sent
  }

  private static contentRows(outline: ProjectOutline, raw: unknown): ProgressContentRow[] {
    const input = Array.isArray(raw) ? raw : []
    const base = (outline.milestones || []).map((m) => m.content || '')
    const names = base.length ? base : input.map((r) => String((r as { milestone?: string }).milestone || ''))
    return names.filter(Boolean).map((milestone) => {
      const hit = input.find((r) => String((r as { milestone?: string }).milestone || '') === milestone) as
        | { progress?: string; done?: string }
        | undefined
      return {
        milestone,
        progress: String(hit?.progress || ''),
        done: String(hit?.done || ''),
      }
    })
  }

  private static productRows(outline: ProjectOutline, raw: unknown): ProgressProductRow[] {
    const input = Array.isArray(raw) ? raw : []
    return (outline.expectedProducts || []).map((p) => {
      const hit = input.find((r) => String((r as { name?: string }).name || '') === p.name) as
        | { achieved?: string }
        | undefined
      return {
        name: p.name,
        planned: [p.quantity, p.quality].filter(Boolean).join(' / '),
        achieved: String(hit?.achieved || ''),
      }
    })
  }
}
