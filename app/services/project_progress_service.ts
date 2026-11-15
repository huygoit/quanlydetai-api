import { DateTime } from 'luxon'
import ProjectContract from '#models/project_contract'
import ProjectOutline from '#models/project_outline'
import ProjectProgressPeriod from '#models/project_progress_period'
import ProjectProgressReport from '#models/project_progress_report'
import type { ProgressContentRow, ProgressProductRow } from '#models/project_progress_report'
import { FILE_LIMIT, PROGRESS_REMIND_DAYS, type BctdStatus } from '#constants/module56'
import EmailLogService from '#services/email_log_service'
import NotificationService from '#services/notification_service'
import ProjectContractService from '#services/project_contract_service'
import { milestonesFromOutline } from '#constants/contract_draft_form'
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

/** Mốc tiến độ dùng cho kỳ / form báo cáo (ưu tiên hợp đồng). */
type MocTienDo = {
  content: string
  thoiGian?: string
  sanPham?: string
  endDate?: string | null
}

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
  /** Ưu tiên mốc tiến độ trên hợp đồng (dự thảo đã ký), fallback thuyết minh. */
  static async milestonesFromContract(outline: ProjectOutline): Promise<MocTienDo[]> {
    if (outline.activeContractId) {
      const hd = await ProjectContract.find(outline.activeContractId)
      if (hd?.mergePayload) {
        const draft = ProjectContractService.readDraftForm(outline, hd.mergePayload)
        if (draft.milestones?.length) {
          return draft.milestones
            .map((m) => ({
              content: String(m.content || '').trim(),
              thoiGian: String(m.thoiGian || '').trim(),
              sanPham: String(m.sanPham || '').trim(),
              endDate: this.endDateFromThoiGian(m.thoiGian) || outline.endDate?.toISODate() || null,
            }))
            .filter((m) => m.content)
        }
      }
    }
    return (outline.milestones || [])
      .map((m) => ({
        content: String(m.content || '').trim(),
        thoiGian: [m.startDate, m.endDate].filter(Boolean).join(' → '),
        sanPham: String(m.expectedResult || '').trim(),
        endDate: m.endDate || null,
      }))
      .filter((m) => m.content)
  }

  private static endDateFromThoiGian(raw?: string) {
    const s = String(raw || '').trim()
    if (!s) return null
    const parts = s.split(/\s*(?:→|->|–|-)\s*/)
    const last = (parts[parts.length - 1] || '').trim()
    // dd/MM/yyyy
    const m = last.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) {
      const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
      const d = DateTime.fromISO(iso)
      return d.isValid ? d.toISODate() : null
    }
    const d2 = DateTime.fromISO(last)
    return d2.isValid ? d2.toISODate() : null
  }

  static async ensurePeriods(outline: ProjectOutline, trx?: TransactionClientContract) {
    const q = ProjectProgressPeriod.query()
    if (trx) q.useTransaction(trx)
    const existed = await q.where('project_outline_id', outline.id).first()
    if (existed) return

    const milestones = await this.milestonesFromContract(outline)
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

  /**
   * Sau BGH duyệt ĐC: đồng bộ HĐ (merge_payload + Word) + kỳ báo cáo
   * để tab Hợp đồng / Tiến độ hiện nội dung mới.
   */
  static async refreshAfterAdjustment(
    outline: ProjectOutline,
    actorId: number | null = null
  ) {
    // Reload để chắc milestones / endDate / CNNV đã persist
    const fresh = (await ProjectOutline.find(outline.id)) || outline

    // 1) Cập nhật HĐ đang gắn: form dự thảo + xuất lại Word
    if (fresh.activeContractId) {
      const hd = await ProjectContract.find(fresh.activeContractId)
      if (hd) {
        const draftCu = ProjectContractService.readDraftForm(fresh, hd.mergePayload)
        const mocMoi = milestonesFromOutline(fresh.milestones)
        const fromOutline = await ProjectContractService.buildMergePayload(fresh)
        // Giữ biến HĐ cũ, ghi đè CNNV / thời gian / tiến độ theo TM sau ĐC
        let payload: Record<string, string> = {
          ...(hd.mergePayload || {}),
          chu_nhiem: fresh.ownerName || fromOutline.chu_nhiem || '',
          don_vi_chu_nhiem:
            fresh.ownerUnit || fromOutline.don_vi_chu_nhiem || '',
          dien_thoai_chu_nhiem: fromOutline.dien_thoai_chu_nhiem || '',
          email_chu_nhiem:
            fromOutline.email_chu_nhiem || fresh.ownerEmail || '',
          dai_dien_ben_b: fresh.ownerName || fromOutline.dai_dien_ben_b || '',
          to_chuc_ben_b:
            fresh.hostUnit ||
            fresh.ownerUnit ||
            fromOutline.to_chuc_ben_b ||
            '',
          dien_thoai_ben_b: fromOutline.dien_thoai_ben_b || '',
          email_ben_b: fromOutline.email_ben_b || fresh.ownerEmail || '',
          dia_chi_ben_b: fromOutline.dia_chi_ben_b || '',
        }
        const ngayBd =
          fresh.startDate?.toFormat('dd/MM/yyyy') || draftCu.ngayBatDau
        const ngayKt =
          fresh.endDate?.toFormat('dd/MM/yyyy') || draftCu.ngayKetThuc
        let soThang = draftCu.soThang
        if (fresh.startDate && fresh.endDate) {
          soThang = String(
            Math.max(
              1,
              Math.round(fresh.endDate.diff(fresh.startDate, 'months').months)
            )
          )
        }
        payload = ProjectContractService.applyDraftFormToPayload(payload, {
          milestones: mocMoi.length ? mocMoi : draftCu.milestones,
          funding: draftCu.funding,
          tongKinhPhi: draftCu.tongKinhPhi,
          soThang,
          ngayBatDau: ngayBd,
          ngayKetThuc: ngayKt,
        })
        // Xuất lại DOCX để tab HĐ / file tải về khớp nội dung mới
        await ProjectContractService.persistDocx(fresh, hd, payload, actorId)
      }
    }

    // 2) Đồng bộ kỳ báo cáo theo mốc mới (ưu tiên HĐ sau bước 1)
    const moc = await this.milestonesFromContract(fresh)
    const periods = await ProjectProgressPeriod.query()
      .where('project_outline_id', fresh.id)
      .orderBy('id', 'asc')
    const daDung = new Set<number>()

    for (let index = 0; index < moc.length; index++) {
      const m = moc[index]!
      const due = dueFromMilestone(m.endDate, fresh.endDate)
      if (!due) continue
      const title = m.content || `Mốc ${index + 1}`

      let period =
        periods.find(
          (p) =>
            p.kind === 'MILESTONE' &&
            p.sourceIndex === index &&
            !daDung.has(p.id)
        ) ||
        periods.find(
          (p) =>
            p.kind === 'MILESTONE' &&
            p.title === title &&
            !daDung.has(p.id)
        )

      if (period) {
        daDung.add(period.id)
        period.title = title
        period.dueOn = due
        period.sourceIndex = index
        await period.save()
      } else {
        await ProjectProgressPeriod.create({
          projectOutlineId: fresh.id,
          title,
          dueOn: due,
          kind: 'MILESTONE',
          sourceIndex: index,
          remindedDays: [],
        })
      }
    }

    // 3) Cập nhật hạn kỳ giữa kỳ theo thời gian mới
    for (const period of periods) {
      if (period.kind === 'MIDPOINT' && fresh.startDate && fresh.endDate) {
        const ms = fresh.endDate.diff(fresh.startDate).milliseconds / 2
        period.dueOn = fresh.startDate.plus({ milliseconds: ms }).startOf('day')
        await period.save()
      }
    }
  }

  static async list(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    await this.assertViewer(userId, outline)
    // Hồ sơ cũ thiếu kỳ → tạo lại từ mốc hợp đồng / giữa thời gian thực hiện
    await this.ensurePeriods(outline)
    const periods = await ProjectProgressPeriod.query()
      .where('project_outline_id', outlineId)
      .orderBy('due_on', 'asc')
    const reports = await ProjectProgressReport.query().where('project_outline_id', outlineId)
    const finance = await budgetSnapshot(outlineId)
    const now = today()
    const mocHd = await this.milestonesFromContract(outline)
    const contentTemplate = mocHd.map((m) => ({
      milestone: m.content,
      progress: '',
      done: '',
      thoiGian: m.thoiGian || '',
      sanPham: m.sanPham || '',
    }))
    const productTemplate = (outline.expectedProducts || []).map((p) => ({
      name: p.name,
      planned: [p.quantity, p.quality].filter(Boolean).join(' / '),
      achieved: '',
    }))
    const budget =
      outline.confirmedBudget != null
        ? Number(outline.confirmedBudget)
        : outline.approvedBudget != null
          ? Number(outline.approvedBudget)
          : Number(outline.requestedBudget || 0)
    return {
      outline: {
        id: outline.id,
        code: outline.code,
        title: outline.title,
        ownerName: outline.ownerName,
        ownerUnit: outline.ownerUnit,
        startDate: outline.startDate?.toISODate() ?? null,
        endDate: outline.endDate?.toISODate() ?? null,
        budget,
        executionStatus: outline.executionStatus,
      },
      // Danh sách tiến độ thực hiện trên hợp đồng — FE chọn để báo cáo
      milestones: mocHd,
      templates: {
        contentRows: contentTemplate.length
          ? contentTemplate
          : [{ milestone: 'Nội dung theo hợp đồng', progress: '', done: '' }],
        productRows: productTemplate,
      },
      finance: {
        advanced: finance.reduce((s, l) => s + l.advanced, 0),
        spent: finance.reduce((s, l) => s + l.spent, 0),
        settled: finance.reduce((s, l) => s + l.settled, 0),
        lines: finance,
      },
      periods: periods.map((p) => {
        const report = reports.find((r) => r.periodId === p.id) || null
        const overdue = p.dueOn.startOf('day') < now && report?.status !== 'BCTD_DONE'
        const daysLeft = Math.round(p.dueOn.startOf('day').diff(now, 'days').days)
        return {
          id: p.id,
          title: p.title,
          dueOn: p.dueOn.toISODate(),
          kind: p.kind,
          overdue,
          daysLeft,
          report: report ? this.serializeReport(report) : null,
        }
      }),
    }
  }

  /** Xóa báo cáo nháp / cần bổ sung. */
  static async remove(id: number, userId: number) {
    const report = await ProjectProgressReport.find(id)
    if (!report) throw new Error('NOT_FOUND')
    if (!['BCTD_DRAFT', 'BCTD_BS'].includes(report.status)) throw new Error('BAD_STATUS')
    const outline = await loadOutline(report.projectOutlineId)
    const isOwner = await isCnnv(userId, outline)
    const isPkh = await hasPerm(userId, 'project.contract_manage')
    if (!isOwner && !isPkh) throw new Error('FORBIDDEN')
    await report.delete()
    return { id }
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

    const mocHd = await this.milestonesFromContract(outline)
    const contentRows = this.contentRows(mocHd, body.contentRows)
    const productRows = this.productRows(outline, body.productRows)
    const nextPlan = String(body.nextPlan ?? body.next_plan ?? '').trim()
    const recommendation = String(body.recommendation ?? '').trim() || null
    const attachments = parseFiles(body.attachments, { maxTotal: FILE_LIMIT.progressTotal })

    if (submit) {
      if (!nextPlan) throw new Error('NEXT_PLAN_REQUIRED')
      if (!contentRows.length || contentRows.some((r) => !r.progress.trim() || !r.done.trim())) {
        throw new Error('CONTENT_ROWS_INCOMPLETE')
      }
      if (productRows.length && productRows.some((r) => !r.achieved.trim())) {
        throw new Error('PRODUCT_ROWS_INCOMPLETE')
      }
    }

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
      // PKH click thông báo → mở thẳng tab Báo cáo tiến độ
      const linkTienDo = outline.activeContractId
        ? `/projects/contracts/${outline.activeContractId}?tab=tiendo`
        : `/projects/progress/${outline.id}?tab=tiendo`
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Báo cáo tiến độ chờ ghi nhận',
        message: `${outline.code}: ${period.title}`,
        link: linkTienDo,
      })
    }
    await report.save()
    return this.serializeReport(report)
  }

  static async pkhAction(reportId: number, userId: number, accept: boolean, note: string) {
    await assertPerm(userId, 'project.contract_manage')
    const report = await ProjectProgressReport.find(reportId)
    if (!report || report.status !== 'BCTD_CHO_PKH') throw new Error('BAD_STATUS')
    if (!accept && !note.trim()) throw new Error('REASON_REQUIRED')
    const outline = await loadOutline(report.projectOutlineId)
    report.pkhNote = note || null
    report.status = (accept ? 'BCTD_DONE' : 'BCTD_BS') as BctdStatus
    await report.save()
    if (outline.ownerId) {
      const linkTienDo = outline.activeContractId
        ? `/projects/contracts/${outline.activeContractId}?tab=tiendo`
        : `/projects/progress/${outline.id}?tab=tiendo`
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: accept ? 'Báo cáo tiến độ đã được ghi nhận' : 'Báo cáo tiến độ cần bổ sung',
        message: `${outline.code}${note ? `: ${note}` : ''}`,
        link: linkTienDo,
      })
      if (!accept) {
        const { buildProgressReturnEmail } = await import('#utils/progress_report_email')
        const mail = buildProgressReturnEmail({
          ownerName: outline.ownerName,
          code: outline.code,
          title: outline.title,
          note: note.trim(),
          outlineId: outline.id,
        })
        await EmailLogService.logStubToUser(
          outline.ownerId,
          mail.subject,
          mail.text,
          'progress_report',
          report.id,
          mail.html
        )
      }
    }
    return this.serializeReport(report)
  }

  /**
   * Nhắc 30/14/7/3 ngày trước hạn nộp báo cáo tiến độ.
   * Duyệt mọi nhiệm vụ Đang thực hiện → mọi kỳ/mốc công việc của nhiệm vụ đó.
   * Gọi từ ace remind:module56 hoặc job 1 lần/ngày.
   */
  static async sendReminders() {
    // 1) Lấy toàn bộ nhiệm vụ đang thực hiện (có CNNV)
    const outlines = await ProjectOutline.query()
      .where('execution_status', 'DANG_THUC_HIEN')
      .whereNotNull('owner_id')
    if (!outlines.length) return 0

    const outlineById = new Map(outlines.map((o) => [o.id, o]))
    const outlineIds = outlines.map((o) => o.id)

    // 2) Lấy mọi kỳ báo cáo / mốc công việc của các nhiệm vụ đó
    const periods = await ProjectProgressPeriod.query()
      .whereIn('project_outline_id', outlineIds)
      .orderBy('due_on', 'asc')
    if (!periods.length) return 0

    const periodIds = periods.map((p) => p.id)
    const reports = await ProjectProgressReport.query().whereIn('period_id', periodIds)
    const reportByPeriod = new Map(reports.map((r) => [r.periodId, r]))

    const now = today()
    const { buildProgressReminderEmail } = await import('#utils/progress_report_email')
    let sent = 0

    for (const period of periods) {
      const outline = outlineById.get(period.projectOutlineId)
      if (!outline?.ownerId) continue

      // 3) Chỉ nhắc đúng các mốc còn 30 / 14 / 7 / 3 ngày
      const daysLeft = Math.round(period.dueOn.startOf('day').diff(now, 'days').days)
      if (!PROGRESS_REMIND_DAYS.includes(daysLeft as (typeof PROGRESS_REMIND_DAYS)[number])) {
        continue
      }

      const reminded = period.remindedDays || []
      if (reminded.includes(daysLeft)) continue

      // Đã ghi nhận xong thì không nhắc nữa
      const report = reportByPeriod.get(period.id)
      if (report?.status === 'BCTD_DONE') continue

      const dueLabel = period.dueOn.toFormat('dd/MM/yyyy')
      const mail = buildProgressReminderEmail({
        ownerName: outline.ownerName,
        code: outline.code,
        title: outline.title,
        periodTitle: period.title,
        dueOn: dueLabel,
        daysLeft,
        outlineId: outline.id,
      })
      const linkTienDo = outline.activeContractId
        ? `/projects/contracts/${outline.activeContractId}?tab=tiendo`
        : `/projects/progress/${outline.id}?tab=tiendo`
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: mail.subject,
        message: `${outline.code} — ${period.title}, hạn ${dueLabel}.`,
        link: linkTienDo,
      })
      await EmailLogService.logStubToUser(
        outline.ownerId,
        mail.subject,
        mail.text,
        'progress_period',
        period.id,
        mail.html
      )
      period.remindedDays = [...reminded, daysLeft]
      await period.save()
      sent += 1
    }
    return sent
  }

  /**
   * Chỉ nhận các mốc nằm trong danh sách tiến độ hợp đồng.
   * FE chọn subset để báo cáo — không ép đủ mọi mốc.
   */
  private static contentRows(mocHd: MocTienDo[], raw: unknown): ProgressContentRow[] {
    const allowed = new Set(mocHd.map((m) => m.content).filter(Boolean))
    const input = Array.isArray(raw) ? raw : []
    const rows: ProgressContentRow[] = []
    const seen = new Set<string>()
    for (const item of input) {
      if (!item || typeof item !== 'object') continue
      const o = item as { milestone?: string; progress?: string; done?: string }
      const milestone = String(o.milestone || '').trim()
      if (!milestone || seen.has(milestone)) continue
      // Nếu có danh sách HĐ thì chỉ cho chọn trong đó; không có thì nhận theo payload
      if (allowed.size && !allowed.has(milestone)) continue
      seen.add(milestone)
      rows.push({
        milestone,
        progress: String(o.progress || ''),
        done: String(o.done || ''),
      })
    }
    return rows
  }

  private static productRows(outline: ProjectOutline, raw: unknown): ProgressProductRow[] {
    const input = Array.isArray(raw) ? raw : []
    const expected = outline.expectedProducts || []
    // Form mới: 1 dòng sản phẩm cùng hàng nội dung công việc — nhận theo payload
    if (input.length) {
      const seen = new Set<string>()
      const out: ProgressProductRow[] = []
      for (const item of input) {
        if (!item || typeof item !== 'object') continue
        const o = item as { name?: string; planned?: string; achieved?: string }
        const name = String(o.name || '').trim()
        if (!name || seen.has(name)) continue
        seen.add(name)
        const base = expected.find((p) => p.name === name)
        out.push({
          name,
          planned: base
            ? [base.quantity, base.quality].filter(Boolean).join(' / ')
            : String(o.planned || ''),
          achieved: String(o.achieved || ''),
        })
      }
      if (out.length) return out
    }
    return expected.map((p) => ({
      name: p.name,
      planned: [p.quantity, p.quality].filter(Boolean).join(' / '),
      achieved: '',
    }))
  }
}
