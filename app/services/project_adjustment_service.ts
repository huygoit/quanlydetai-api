import fs from 'node:fs/promises'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import ScientificProfile from '#models/scientific_profile'
import KpiResult from '#models/kpi_result'
import ProjectAdjustment from '#models/project_adjustment'
import type { AdjustmentChanges, AdjustmentProgressUpdate } from '#models/project_adjustment'
import ProjectBudgetLine from '#models/project_budget_line'
import ProjectProgressPeriod from '#models/project_progress_period'
import ProjectProgressReport from '#models/project_progress_report'
import NotificationService from '#services/notification_service'
import ProjectProgressService from '#services/project_progress_service'
import KpiEngineService from '#services/kpi_engine_service'
import { khoangNamTaiChinh } from '#utils/kpi_period_helper'
import { buildFormDocx } from '#utils/simple_docx'
import {
  buildPublicGeneratedContractUrl,
  resolveGeneratedContractDir,
} from '#utils/docx_merge_helper'
import { BUDGET_LINE_CODES, type BudgetLineCode, type DcStatus } from '#constants/module56'
import {
  assertCnnv,
  assertExecution,
  assertPerm,
  assertReady,
  hasPerm,
  isCnnv,
  iso,
  loadOutline,
  money,
} from '#services/module56_common'

const EDITABLE: DcStatus[] = ['DC_DRAFT', 'DC_BS']
const OPEN: DcStatus[] = ['DC_DRAFT', 'DC_PENDING_PKH', 'DC_BS', 'DC_PENDING_BGH']

/**
 * BM.09 — điều chỉnh cả phiếu, có mục kinh phí (QD-05).
 */
export default class ProjectAdjustmentService {
  static async serialize(row: ProjectAdjustment) {
    const changes = row.changes || {}
    // Chủ nhiệm mới: trả hồ sơ đầy đủ (tên / học hàm / NCKH) thay vì chỉ userId
    const principalUserId = Number(changes.principalUserId || 0)
    const principalProfile = principalUserId
      ? await this.profileOfUser(principalUserId)
      : null
    return {
      id: row.id,
      projectOutlineId: row.projectOutlineId,
      status: row.status,
      reason: row.reason,
      evidenceAttachments: row.evidenceAttachments || [],
      changes,
      principalProfile,
      leadConfirmed: row.leadConfirmed,
      decisionNote: row.decisionNote,
      appliedDiff: row.appliedDiff,
      appendixFileUrl: row.appendixFileUrl,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }
  }

  static async list(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    if (!(await isCnnv(userId, outline)) && !(await hasPerm(userId, 'project.view')) && !(await hasPerm(userId, 'project.contract_manage')) && !(await hasPerm(userId, 'project.outline_approve'))) {
      throw new Error('FORBIDDEN')
    }
    const rows = await ProjectAdjustment.query().where('project_outline_id', outlineId).orderBy('id', 'desc')
    return Promise.all(rows.map((r) => this.serialize(r)))
  }

  /** Ngữ cảnh form điều chỉnh: thời gian / CNNV / mốc + tiến độ đã báo cáo */
  static async context(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    if (
      !(await isCnnv(userId, outline)) &&
      !(await hasPerm(userId, 'project.view')) &&
      !(await hasPerm(userId, 'project.contract_manage')) &&
      !(await hasPerm(userId, 'project.outline_approve'))
    ) {
      throw new Error('FORBIDDEN')
    }
    await ProjectProgressService.ensurePeriods(outline)
    const ownerProfile = outline.ownerId ? await this.profileOfUser(outline.ownerId) : null
    const periods = await ProjectProgressPeriod.query()
      .where('project_outline_id', outline.id)
      .orderBy('due_on', 'asc')
    const reports = await ProjectProgressReport.query().where('project_outline_id', outline.id)
    const contentRows = periods.map((p) => {
      const report = reports.find((r) => r.periodId === p.id) || null
      const first = report?.contentRows?.[0]
      return {
        periodId: p.id,
        title: p.title,
        dueOn: p.dueOn.toISODate(),
        kind: p.kind,
        reportStatus: report?.status || null,
        progress: first?.progress || '',
        done: first?.done || '',
        milestone: first?.milestone || p.title,
      }
    })
    const milestones = (outline.milestones || []).map((m, idx) => ({
      content: m.content || '',
      startDate: m.startDate || null,
      endDate: m.endDate || null,
      expectedResult: m.expectedResult || null,
      // Ghép % tiến độ nếu có kỳ trùng tên
      progress:
        contentRows.find((c) => c.title === m.content || c.milestone === m.content)?.progress || '',
      periodId:
        contentRows.find((c) => c.title === m.content || c.milestone === m.content)?.periodId ||
        null,
      reportStatus:
        contentRows.find((c) => c.title === m.content || c.milestone === m.content)?.reportStatus ||
        null,
      sourceIndex: idx,
    }))
    return {
      outline: {
        id: outline.id,
        code: outline.code,
        title: outline.title,
        startDate: outline.startDate?.toISODate() ?? null,
        endDate: outline.endDate?.toISODate() ?? null,
        ownerId: outline.ownerId,
        ownerName: outline.ownerName,
        ownerUnit: outline.ownerUnit,
        researchContent: outline.researchContent,
        extensionCount: outline.extensionCount || 0,
        activeContractId: outline.activeContractId,
      },
      ownerProfile,
      milestones,
      progressRows: contentRows,
    }
  }

  /** Tìm ứng viên chủ nhiệm (CNNV của nhiệm vụ cũng gọi được) */
  static async searchPrincipals(outlineId: number, userId: number, keyword: string) {
    const outline = await loadOutline(outlineId)
    if (
      !(await isCnnv(userId, outline)) &&
      !(await hasPerm(userId, 'project.contract_manage')) &&
      !(await hasPerm(userId, 'project.view'))
    ) {
      throw new Error('FORBIDDEN')
    }
    const kw = String(keyword || '').trim()
    if (kw.length < 2) return []
    const like = `%${kw}%`
    const profiles = await ScientificProfile.query()
      .whereNotNull('user_id')
      .where((b) => {
        b.whereILike('full_name', like)
          .orWhereILike('work_email', like)
          .orWhereILike('department', like)
          .orWhereILike('faculty', like)
      })
      .limit(30)
    const out = []
    for (const p of profiles) {
      if (!p.userId) continue
      out.push({
        userId: p.userId,
        fullName: p.fullName,
        email: p.workEmail,
        degree: p.degree,
        academicTitle: p.academicTitle,
        unit: p.department || p.faculty || p.organization || null,
        nckhHours: await this.nckhHoursOfProfile(p.id),
      })
    }
    return out
  }

  private static async profileOfUser(userId: number) {
    const p = await ScientificProfile.query().where('user_id', userId).first()
    if (!p) {
      const u = await User.find(userId)
      return {
        userId,
        fullName: u?.fullName || '',
        email: u?.email || null,
        degree: null as string | null,
        academicTitle: null as string | null,
        unit: null as string | null,
        nckhHours: null as number | null,
      }
    }
    return {
      userId,
      fullName: p.fullName,
      email: p.workEmail,
      degree: p.degree,
      academicTitle: p.academicTitle,
      unit: p.department || p.faculty || p.organization || null,
      nckhHours: await this.nckhHoursOfProfile(p.id),
    }
  }

  /** Giờ NCKH: ưu tiên cache kpi_results, không có thì tính trực tiếp năm TC hiện tại */
  private static async nckhHoursOfProfile(profileId: number) {
    const kpi = await KpiResult.query()
      .where('profile_id', profileId)
      .orderBy('academic_year', 'desc')
      .first()
    if (kpi) return Number(kpi.totalHours || 0)
    try {
      const live = await KpiEngineService.calculateTeacherKpi(
        profileId,
        khoangNamTaiChinh()
      )
      return Number(live.totalHours || 0)
    } catch {
      return null
    }
  }

  static async save(userId: number, body: Record<string, unknown>, submit: boolean) {
    const outline = await loadOutline(Number(body.projectOutlineId || body.project_outline_id))
    assertReady(outline)
    assertExecution(outline, ['DANG_THUC_HIEN'])
    await assertCnnv(userId, outline)

    const reason = String(body.reason || '').trim()
    if (!reason) throw new Error('REASON_REQUIRED')
    const changes = this.parseChanges(body.changes)
    const id = Number(body.id || 0)
    let row = id ? await ProjectAdjustment.find(id) : null
    if (row && (row.projectOutlineId !== outline.id || !EDITABLE.includes(row.status))) {
      throw new Error('BAD_STATUS')
    }
    const pending = await ProjectAdjustment.query()
      .where('project_outline_id', outline.id)
      .whereIn('status', OPEN)
      .whereNot('id', row?.id || 0)
      .first()
    if (pending) throw new Error('ADJUSTMENT_OPEN')

    if (!row) {
      row = new ProjectAdjustment()
      row.projectOutlineId = outline.id
      row.createdBy = userId
      row.status = 'DC_DRAFT'
      row.leadConfirmed = false
    }
    row.reason = reason
    // Chỉ nhận file upload — không nhập URL tay
    const rawFiles = body.evidenceAttachments || body.evidence_attachments || body.attachments
    if (Array.isArray(rawFiles)) {
      row.evidenceAttachments = rawFiles
        .map((x) => {
          if (!x || typeof x !== 'object') return null
          const o = x as Record<string, unknown>
          const fileUrl = String(o.fileUrl || o.file_url || '').trim()
          if (!fileUrl) return null
          return {
            fileName: String(o.fileName || o.file_name || 'minh-chung'),
            fileUrl,
            fileSize: Number(o.fileSize || o.file_size || 0),
          }
        })
        .filter(Boolean) as { fileName: string; fileUrl: string; fileSize: number }[]
    } else {
      row.evidenceAttachments = row.evidenceAttachments || []
    }
    row.changes = changes
    row.leadConfirmed = false
    row.leadConfirmedBy = null
    if (submit) {
      row.status = 'DC_PENDING_PKH'
    }
    await row.save()
    if (submit) {
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Đề nghị điều chỉnh nhiệm vụ',
        message: outline.code,
        link: this.linkDieuChinh(row.id, outline),
      })
    }
    return await this.serialize(row)
  }

  static async pkhAct(id: number, userId: number, action: 'accept' | 'return', note: string) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await ProjectAdjustment.find(id)
    if (!row || row.status !== 'DC_PENDING_PKH') throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)
    if (action === 'return') {
      if (!note.trim()) throw new Error('REASON_REQUIRED')
      row.status = 'DC_BS'
      row.decisionNote = note.trim()
      await row.save()
      // CNNV nhận thông báo — trạng thái Chờ bổ sung
      await this.tell(
        outline.ownerId,
        'Điều chỉnh chờ bổ sung',
        note.trim(),
        row.id,
        outline
      )
      return await this.serialize(row)
    }
    if (action !== 'accept') throw new Error('BAD_STATUS')

    const extendsTime = !!row.changes?.endDate
    if (extendsTime && (outline.extensionCount || 0) >= 1 && !row.leadConfirmed) {
      throw new Error('LEAD_CONFIRM_REQUIRED')
    }
    row.status = 'DC_PENDING_BGH'
    row.decisionNote = note.trim() || null
    await row.save()
    // PKH duyệt → thông báo BGH
    await NotificationService.pushToPermission('project.outline_approve', {
      type: 'PROJECT_UPDATE',
      title: 'Điều chỉnh chờ BGH duyệt',
      message: outline.code,
      link: this.linkDieuChinh(row.id, outline),
    })
    if (row.changes?.budgetLines?.length) {
      await NotificationService.pushToPermission('project.budget_confirm', {
        type: 'PROJECT_UPDATE',
        title: 'Điều chỉnh có thay đổi kinh phí',
        message: outline.code,
        link: this.linkDieuChinh(row.id, outline),
      })
    }
    return await this.serialize(row)
  }

  static async leadConfirm(id: number, userId: number) {
    await assertPerm(userId, 'project.contract_lead_confirm')
    const row = await ProjectAdjustment.find(id)
    if (!row || row.status !== 'DC_PENDING_PKH') throw new Error('BAD_STATUS')
    row.leadConfirmed = true
    row.leadConfirmedBy = userId
    await row.save()
    return await this.serialize(row)
  }

  static async bghAct(id: number, userId: number, accept: boolean, note: string) {
    await assertPerm(userId, 'project.outline_approve')
    const row = await ProjectAdjustment.find(id)
    if (!row || row.status !== 'DC_PENDING_BGH') throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)
    if (!accept) {
      if (!note.trim()) throw new Error('REASON_REQUIRED')
      // Trạng thái Từ chối — báo PKH + CNNV
      row.status = 'DC_REJECTED'
      row.decisionNote = note.trim()
      await row.save()
      const link = this.linkDieuChinh(row.id, outline)
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'BGH từ chối điều chỉnh',
        message: `${outline.code}: ${note.trim()}`,
        link,
      })
      await this.tell(
        outline.ownerId,
        'BGH từ chối điều chỉnh',
        note.trim(),
        row.id,
        outline
      )
      return await this.serialize(row)
    }

    const before = {
      endDate: outline.endDate?.toISODate() ?? null,
      ownerId: outline.ownerId,
      researchContent: outline.researchContent,
      milestones: outline.milestones,
    }
    await db.transaction(async (trx) => {
      outline.useTransaction(trx)
      row.useTransaction(trx)
      const changes = row.changes || {}
      if (changes.endDate) {
        const d = DateTime.fromISO(changes.endDate)
        if (!d.isValid) throw new Error('INVALID_DATE')
        outline.endDate = d
        outline.extensionCount = (outline.extensionCount || 0) + 1
      }
      if (changes.principalUserId) {
        const user = await User.find(changes.principalUserId)
        if (!user) throw new Error('USER_NOT_FOUND')
        const oldId = outline.ownerId
        outline.ownerId = user.id
        outline.ownerName = user.fullName
        outline.ownerEmail = user.email
        // Cập nhật đơn vị CNNV từ hồ sơ khoa học (để HĐ / form khớp)
        const sp = await ScientificProfile.query().where('user_id', user.id).first()
        if (sp) {
          outline.ownerUnit =
            sp.department || sp.faculty || sp.organization || outline.ownerUnit
        }
        if (oldId && oldId !== user.id) {
          const link = this.linkDieuChinh(row.id, outline)
          await NotificationService.push(oldId, {
            type: 'PROJECT_UPDATE',
            title: 'Bạn không còn là chủ nhiệm',
            message: outline.code,
            link,
          })
          await NotificationService.push(user.id, {
            type: 'PROJECT_UPDATE',
            title: 'Bạn được giao chủ nhiệm nhiệm vụ',
            message: outline.code,
            link,
          })
        }
      }
      if (changes.content) outline.researchContent = changes.content
      if (changes.milestones) {
        // Chỉ ghi field chuẩn TM — bỏ progress tạm trên phiếu ĐC
        outline.milestones = changes.milestones.map((m) => ({
          content: m.content,
          startDate: m.startDate ?? null,
          endDate: m.endDate ?? null,
          expectedResult: m.expectedResult ?? null,
        }))
      }
      if (changes.budgetLines?.length) {
        const nextTotal = changes.budgetLines.reduce((s, l) => s + l.amount, 0)
        await ProjectBudgetLine.query({ client: trx }).where('project_outline_id', outline.id).delete()
        await ProjectBudgetLine.createMany(
          changes.budgetLines.map((l) => ({
            projectOutlineId: outline.id,
            code: l.code as BudgetLineCode,
            amount: l.amount,
          })),
          { client: trx }
        )
        outline.approvedBudget = nextTotal
      }
      await outline.save()
      // Áp điều chỉnh tiến độ / nội dung kỳ đã báo cáo
      // Ghép thêm % lưu trên milestones (nháp) nếu progressUpdates thiếu periodId
      const updates: AdjustmentProgressUpdate[] = [...(changes.progressUpdates || [])]
      for (const m of changes.milestones || []) {
        const pct = (m as { progress?: string | null }).progress
        if (!pct) continue
        const title = String(m.content || '').trim()
        if (!title) continue
        if (updates.some((u) => u.title === title || (u.periodId && u.progress))) continue
        updates.push({
          periodId: 0,
          progress: String(pct),
          title,
          dueOn: m.endDate || null,
        })
      }
      for (const u of updates) {
        let period =
          u.periodId > 0
            ? await ProjectProgressPeriod.query({ client: trx })
                .where('id', u.periodId)
                .where('project_outline_id', outline.id)
                .first()
            : null
        if (!period && u.title?.trim()) {
          period = await ProjectProgressPeriod.query({ client: trx })
            .where('project_outline_id', outline.id)
            .where('title', u.title.trim())
            .first()
        }
        if (!period) continue
        if (u.title?.trim()) period.title = u.title.trim()
        if (u.dueOn) {
          const d = DateTime.fromISO(u.dueOn)
          if (d.isValid) period.dueOn = d
        }
        await period.save()
        const report = await ProjectProgressReport.query({ client: trx })
          .where('period_id', period.id)
          .first()
        if (report) {
          const rows = [...(report.contentRows || [])]
          if (!rows.length) {
            rows.push({
              milestone: period.title,
              progress: String(u.progress || ''),
              done: String(u.done || ''),
            })
          } else {
            rows[0] = {
              ...rows[0],
              milestone: u.title?.trim() || rows[0].milestone || period.title,
              progress:
                u.progress != null && u.progress !== ''
                  ? String(u.progress)
                  : rows[0].progress,
              done: u.done != null && u.done !== '' ? String(u.done) : rows[0].done,
            }
          }
          report.useTransaction(trx)
          report.contentRows = rows
          await report.save()
        }
      }
      row.status = 'DC_APPROVED'
      row.decisionNote = note.trim() || null
      row.appliedDiff = { before, changes }
      await this.writeAppendix(outline, row, before, changes)
      await row.save()
    })
    // Đồng bộ HĐ (Word + form) + kỳ tiến độ theo nội dung ĐC vừa duyệt
    await ProjectProgressService.refreshAfterAdjustment(outline, userId)
    await this.tell(
      outline.ownerId,
      'Điều chỉnh đã được duyệt',
      outline.code,
      row.id,
      outline
    )
    return await this.serialize(row)
  }

  private static async writeAppendix(
    outline: Awaited<ReturnType<typeof loadOutline>>,
    row: ProjectAdjustment,
    before: {
      endDate: string | null
      ownerId: number | null
      researchContent: string | null
      milestones: unknown
    },
    changes: AdjustmentChanges
  ) {
    const blocks: { heading: string; lines: string[] }[] = [
      { heading: 'Lý do', lines: [row.reason || ''] },
    ]
    if (changes.endDate) {
      blocks.push({
        heading: 'Thời gian',
        lines: [`Trước: ${before.endDate || ''}`, `Sau: ${changes.endDate}`],
      })
    }
    if (changes.principalUserId) {
      blocks.push({
        heading: 'Chủ nhiệm',
        lines: [`Trước: ${before.ownerId ?? ''}`, `Sau: ${changes.principalUserId}`],
      })
    }
    if (changes.content) {
      blocks.push({
        heading: 'Nội dung',
        lines: [`Trước: ${before.researchContent || ''}`, `Sau: ${changes.content}`],
      })
    }
    if (changes.milestones) {
      blocks.push({
        heading: 'Mốc tiến độ',
        lines: changes.milestones.map((m) => m.content || ''),
      })
    }
    if (changes.budgetLines?.length) {
      blocks.push({
        heading: 'Kinh phí',
        lines: changes.budgetLines.map((l) => `${l.code}: ${l.amount}`),
      })
    }
    const buf = buildFormDocx(`PHỤ LỤC ĐIỀU CHỈNH — ${outline.code}`, blocks)
    const dir = await resolveGeneratedContractDir()
    const stored = `PLDC_${outline.code}_${row.id}_${Date.now()}.docx`.replace(/[^\w.-]/g, '_')
    await fs.writeFile(`${dir}/${stored}`, buf)
    row.appendixFileUrl = buildPublicGeneratedContractUrl(stored)
  }

  private static parseChanges(raw: unknown): AdjustmentChanges {
    const o = (raw || {}) as Record<string, unknown>
    const changes: AdjustmentChanges = {}
    if (o.endDate || o.end_date) changes.endDate = String(o.endDate || o.end_date)
    if (o.principalUserId || o.principal_user_id) {
      changes.principalUserId = Number(o.principalUserId || o.principal_user_id)
      if (!changes.principalUserId) throw new Error('USER_NOT_FOUND')
    }
    if (o.content) changes.content = String(o.content).trim()
    if (Array.isArray(o.milestones)) {
      changes.milestones = o.milestones.map((m) => {
        const item = m as Record<string, unknown>
        // progress chỉ giữ trên phiếu ĐC; khi BGH duyệt sẽ strip trước khi ghi outline
        const progress =
          item.progress != null && String(item.progress).trim() !== ''
            ? String(item.progress)
            : null
        return {
          content: String(item.content || ''),
          startDate: item.startDate ? String(item.startDate) : null,
          endDate: item.endDate ? String(item.endDate) : null,
          expectedResult: item.expectedResult ? String(item.expectedResult) : null,
          ...(progress ? { progress } : {}),
        }
      }) as AdjustmentChanges['milestones']
    }
    if (Array.isArray(o.budgetLines || o.budget_lines)) {
      const list = (o.budgetLines || o.budget_lines) as { code: string; amount: number }[]
      const map = new Map<string, number>()
      for (const line of list) {
        if (!BUDGET_LINE_CODES.includes(line.code as BudgetLineCode)) throw new Error('INVALID_BUDGET_CODE')
        map.set(line.code, money(line.amount))
      }
      if (map.size !== BUDGET_LINE_CODES.length) throw new Error('BUDGET_LINES_INCOMPLETE')
      const sum = [...map.values()].reduce((s, n) => s + n, 0)
      const muc09 = map.get('MUC_09') || 0
      if (muc09 > Math.round(sum * 0.05)) throw new Error('MUC_09_OVER_5_PERCENT')
      changes.budgetLines = BUDGET_LINE_CODES.map((code) => ({ code, amount: map.get(code) || 0 }))
    }
    if (Array.isArray(o.progressUpdates || o.progress_updates)) {
      const list = (o.progressUpdates || o.progress_updates) as AdjustmentProgressUpdate[]
      changes.progressUpdates = list
        .map((x) => ({
          periodId: Number(x.periodId || 0),
          progress: x.progress != null ? String(x.progress) : null,
          done: x.done != null ? String(x.done) : null,
          title: x.title != null ? String(x.title) : null,
          dueOn: x.dueOn != null ? String(x.dueOn) : null,
        }))
        // Giữ dòng có periodId hoặc có %/title (lưu nháp không mất tiến độ)
        .filter(
          (x) =>
            x.periodId > 0 ||
            !!(x.progress && String(x.progress).trim()) ||
            !!(x.title && String(x.title).trim())
        )
    }
    const has =
      !!changes.endDate ||
      !!changes.principalUserId ||
      !!changes.content ||
      !!changes.milestones?.length ||
      !!changes.budgetLines?.length ||
      !!changes.progressUpdates?.length
    if (!has) throw new Error('CHANGES_REQUIRED')
    return changes
  }

  /** Link FE: hub HĐ tab điều chỉnh + mở sheet phiếu (fallback trang redirect) */
  private static linkDieuChinh(
    adjustmentId: number,
    outline?: { activeContractId?: number | null; id?: number } | null
  ) {
    const cid = Number(outline?.activeContractId || 0)
    if (cid > 0) {
      return `/projects/contracts/${cid}?tab=dieuchinh&adjustmentId=${adjustmentId}`
    }
    const oid = Number(outline?.id || 0)
    if (oid > 0) {
      return `/projects/execution/${oid}?tab=dieuchinh&adjustmentId=${adjustmentId}`
    }
    return `/projects/adjustments/${adjustmentId}`
  }

  private static async tell(
    userId: number | null,
    title: string,
    message: string,
    id: number,
    outline?: { activeContractId?: number | null; id?: number } | null
  ) {
    if (!userId) return
    await NotificationService.push(userId, {
      type: 'PROJECT_UPDATE',
      title,
      message,
      link: this.linkDieuChinh(id, outline),
    })
  }

  /** Chi tiết 1 phiếu — phục vụ redirect thông báo cũ /projects/adjustments/:id */
  static async show(id: number, userId: number) {
    const row = await ProjectAdjustment.find(id)
    if (!row) throw new Error('NOT_FOUND')
    const outline = await loadOutline(row.projectOutlineId)
    if (
      !(await isCnnv(userId, outline)) &&
      !(await hasPerm(userId, 'project.view')) &&
      !(await hasPerm(userId, 'project.contract_manage')) &&
      !(await hasPerm(userId, 'project.outline_approve'))
    ) {
      throw new Error('FORBIDDEN')
    }
    const data = await this.serialize(row)
    return {
      ...data,
      redirectTo: this.linkDieuChinh(row.id, outline),
      activeContractId: outline.activeContractId || null,
      outlineCode: outline.code,
    }
  }
}
