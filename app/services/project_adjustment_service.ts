import fs from 'node:fs/promises'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import ProjectAdjustment from '#models/project_adjustment'
import type { AdjustmentChanges } from '#models/project_adjustment'
import ProjectBudgetLine from '#models/project_budget_line'
import NotificationService from '#services/notification_service'
import ProjectProgressService from '#services/project_progress_service'
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
  static serialize(row: ProjectAdjustment) {
    return {
      id: row.id,
      projectOutlineId: row.projectOutlineId,
      status: row.status,
      reason: row.reason,
      evidenceUrl: row.evidenceUrl,
      changes: row.changes || {},
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
    return rows.map((r) => this.serialize(r))
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
    row.evidenceUrl = String(body.evidenceUrl || body.evidence_url || '').trim() || null
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
        link: `/projects/adjustments/${row.id}`,
      })
    }
    return this.serialize(row)
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
      await this.tell(outline.ownerId, 'Điều chỉnh cần bổ sung', note, row.id)
      return this.serialize(row)
    }
    if (action !== 'accept') throw new Error('BAD_STATUS')

    const extendsTime = !!row.changes?.endDate
    if (extendsTime && (outline.extensionCount || 0) >= 1 && !row.leadConfirmed) {
      throw new Error('LEAD_CONFIRM_REQUIRED')
    }
    row.status = 'DC_PENDING_BGH'
    row.decisionNote = note.trim() || null
    await row.save()
    await NotificationService.pushToPermission('project.outline_approve', {
      type: 'PROJECT_UPDATE',
      title: 'Điều chỉnh chờ BGH',
      message: outline.code,
      link: `/projects/adjustments/${row.id}`,
    })
    if (row.changes?.budgetLines?.length) {
      await NotificationService.pushToPermission('project.budget_confirm', {
        type: 'PROJECT_UPDATE',
        title: 'Điều chỉnh có thay đổi kinh phí',
        message: outline.code,
        link: `/projects/adjustments/${row.id}`,
      })
    }
    return this.serialize(row)
  }

  static async leadConfirm(id: number, userId: number) {
    await assertPerm(userId, 'project.contract_lead_confirm')
    const row = await ProjectAdjustment.find(id)
    if (!row || row.status !== 'DC_PENDING_PKH') throw new Error('BAD_STATUS')
    row.leadConfirmed = true
    row.leadConfirmedBy = userId
    await row.save()
    return this.serialize(row)
  }

  static async bghAct(id: number, userId: number, accept: boolean, note: string) {
    await assertPerm(userId, 'project.outline_approve')
    const row = await ProjectAdjustment.find(id)
    if (!row || row.status !== 'DC_PENDING_BGH') throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)
    if (!accept) {
      if (!note.trim()) throw new Error('REASON_REQUIRED')
      row.status = 'DC_REJECTED'
      row.decisionNote = note.trim()
      await row.save()
      await this.tell(outline.ownerId, 'BGH từ chối điều chỉnh', note, row.id)
      return this.serialize(row)
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
        if (oldId && oldId !== user.id) {
          await NotificationService.push(oldId, {
            type: 'PROJECT_UPDATE',
            title: 'Bạn không còn là chủ nhiệm',
            message: outline.code,
            link: `/projects/adjustments/${row.id}`,
          })
          await NotificationService.push(user.id, {
            type: 'PROJECT_UPDATE',
            title: 'Bạn được giao chủ nhiệm nhiệm vụ',
            message: outline.code,
            link: `/projects/adjustments/${row.id}`,
          })
        }
      }
      if (changes.content) outline.researchContent = changes.content
      if (changes.milestones) outline.milestones = changes.milestones
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
      row.status = 'DC_APPROVED'
      row.decisionNote = note.trim() || null
      row.appliedDiff = { before, changes }
      await this.writeAppendix(outline, row, before, changes)
      await row.save()
    })
    await ProjectProgressService.refreshAfterAdjustment(outline)
    await this.tell(outline.ownerId, 'Điều chỉnh đã được duyệt', outline.code, row.id)
    return this.serialize(row)
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
        return {
          content: String(item.content || ''),
          startDate: item.startDate ? String(item.startDate) : null,
          endDate: item.endDate ? String(item.endDate) : null,
          expectedResult: item.expectedResult ? String(item.expectedResult) : null,
        }
      })
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
    const has =
      !!changes.endDate ||
      !!changes.principalUserId ||
      !!changes.content ||
      !!changes.milestones?.length ||
      !!changes.budgetLines?.length
    if (!has) throw new Error('CHANGES_REQUIRED')
    return changes
  }

  private static async tell(userId: number | null, title: string, message: string, id: number) {
    if (!userId) return
    await NotificationService.push(userId, {
      type: 'PROJECT_UPDATE',
      title,
      message,
      link: `/projects/adjustments/${id}`,
    })
  }
}
