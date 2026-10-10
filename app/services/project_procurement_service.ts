import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ProjectProcurement from '#models/project_procurement'
import type { ProcurementItem } from '#models/project_procurement'
import ProjectAsset from '#models/project_asset'
import {
  FILE_LIMIT,
  PROCUREMENT_LINE_CODES,
  type BudgetLineCode,
  type MsStatus,
} from '#constants/module56'
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
  money,
  parseFiles,
  writeLedger,
} from '#services/module56_common'

const KINDS = ['VAT_TU', 'DUNG_CU', 'THIET_BI', 'THUE_NGOAI']
const EDITABLE: MsStatus[] = ['MS_DRAFT', 'MS_BS']

/**
 * Đề nghị mua sắm tách khỏi phiếu tạm ứng (QD-02, QD-18).
 */
export default class ProjectProcurementService {
  static serialize(row: ProjectProcurement) {
    return {
      id: row.id,
      projectOutlineId: row.projectOutlineId,
      kind: row.kind,
      lineCode: row.lineCode,
      purpose: row.purpose,
      neededBy: row.neededBy?.toISODate() ?? null,
      items: row.items || [],
      attachments: row.attachments || [],
      totalAmount: Number(row.totalAmount || 0),
      status: row.status,
      overBudget: row.overBudget,
      overBudgetNote: row.overBudgetNote,
      csvcMethod: row.csvcMethod,
      suppliedAt: iso(row.suppliedAt),
      receivedAt: iso(row.receivedAt),
      voucherNo: row.voucherNo,
      voucherDate: row.voucherDate?.toISODate() ?? null,
      returnReason: row.returnReason,
      createdAt: iso(row.createdAt),
    }
  }

  static async list(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    await this.assertSee(userId, outline)
    const q = ProjectProcurement.query().where('project_outline_id', outlineId).orderBy('id', 'desc')
    if (await this.onlyTc(userId, outline)) q.where('status', 'MS_CHO_TC')
    const rows = await q
    return rows.map((r) => this.serialize(r))
  }

  static async save(userId: number, body: Record<string, unknown>, submit: boolean) {
    const outline = await loadOutline(Number(body.projectOutlineId || body.project_outline_id))
    assertReady(outline)
    assertExecution(outline, ['DANG_THUC_HIEN'])
    await assertCnnv(userId, outline)

    const id = Number(body.id || 0)
    let row = id ? await ProjectProcurement.find(id) : null
    if (row && (row.projectOutlineId !== outline.id || !EDITABLE.includes(row.status))) {
      throw new Error('BAD_STATUS')
    }

    const kind = String(body.kind || '')
    if (!KINDS.includes(kind)) throw new Error('INVALID_KIND')
    const lineCode = String(body.lineCode || body.line_code || '')
    if (!PROCUREMENT_LINE_CODES.includes(lineCode as BudgetLineCode)) throw new Error('INVALID_BUDGET_CODE')
    const purpose = String(body.purpose || '').trim()
    if (!purpose) throw new Error('FORM_INCOMPLETE')
    const items = this.parseItems(body.items)
    const total = items.reduce((s, it) => s + it.amount, 0)
    const attachments = parseFiles(body.attachments, { maxEach: FILE_LIMIT.procurement })
    const needed = body.neededBy || body.needed_by
    const neededBy = needed ? DateTime.fromISO(String(needed)) : null
    const snap = await budgetSnapshot(outline.id)
    const remaining = snap.find((l) => l.code === lineCode)?.remaining ?? 0
    const overBudget = total > remaining
    const note = String(body.overBudgetNote || body.over_budget_note || '').trim()
    if (submit && overBudget && !note) throw new Error('OVER_BUDGET_NOTE_REQUIRED')

    if (!row) {
      row = new ProjectProcurement()
      row.projectOutlineId = outline.id
      row.createdBy = userId
      row.status = 'MS_DRAFT'
    }
    row.kind = kind as ProjectProcurement['kind']
    row.lineCode = lineCode
    row.purpose = purpose
    row.neededBy = neededBy?.isValid ? neededBy : null
    row.items = items
    row.attachments = attachments
    row.totalAmount = total
    row.overBudget = overBudget
    row.overBudgetNote = note || null
    if (submit) {
      row.status = 'MS_CHO_PKH'
      row.returnReason = null
    }
    await row.save()
    if (submit) {
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Đề nghị mua sắm',
        message: `${outline.code}: ${total}${overBudget ? ' (vượt dự toán)' : ''}`,
        link: `/projects/procurements/${row.id}`,
      })
    }
    return this.serialize(row)
  }

  static async pkhAct(id: number, userId: number, action: 'accept' | 'return' | 'to_bs' | 'close', reason: string) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await ProjectProcurement.find(id)
    if (!row) throw new Error('NOT_FOUND')
    const outline = await loadOutline(row.projectOutlineId)
    if (action === 'accept' && row.status === 'MS_CHO_PKH') {
      row.status = 'MS_CHO_CSVC'
      row.returnReason = null
      await row.save()
      await NotificationService.pushToPermission('project.procurement_handle', {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ mua sắm chờ CSVC',
        message: outline.code,
        link: `/projects/procurements/${row.id}`,
      })
    } else if (action === 'return' && row.status === 'MS_CHO_PKH') {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.status = 'MS_BS'
      row.returnReason = reason.trim()
      await row.save()
      await this.tellOwner(outline.ownerId, 'Mua sắm cần bổ sung', reason, row.id)
    } else if (action === 'to_bs' && ['MS_TU_CHOI', 'MS_DAU_THAU_THAT_BAI'].includes(row.status)) {
      row.status = 'MS_BS'
      await row.save()
      await this.tellOwner(outline.ownerId, 'Mua sắm được mở lại để sửa', reason, row.id)
    } else if (action === 'close' && ['MS_TU_CHOI', 'MS_DAU_THAU_THAT_BAI', 'MS_BS'].includes(row.status)) {
      row.status = 'MS_DONG'
      row.returnReason = reason.trim() || row.returnReason
      await row.save()
    } else {
      throw new Error('BAD_STATUS')
    }
    return this.serialize(row)
  }

  static async csvcAct(
    id: number,
    userId: number,
    action: 'supply' | 'reject' | 'bid_fail',
    method: string,
    reason: string
  ) {
    await assertPerm(userId, 'project.procurement_handle')
    const row = await ProjectProcurement.find(id)
    if (!row || row.status !== 'MS_CHO_CSVC') throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)
    if (action === 'supply') {
      if (method !== 'MUA_TRUC_TIEP' && method !== 'DAU_THAU') throw new Error('INVALID_METHOD')
      row.csvcMethod = method
      row.suppliedAt = DateTime.now()
      row.status = 'MS_CHO_NHAN'
      row.returnReason = null
      await row.save()
      await this.tellOwner(outline.ownerId, 'Hàng đã cung ứng, chờ xác nhận nhận', outline.code, row.id)
    } else if (action === 'reject') {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.status = 'MS_TU_CHOI'
      row.returnReason = reason.trim()
      await row.save()
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'CSVC từ chối mua sắm',
        message: `${outline.code}: ${reason.trim()}`,
        link: `/projects/procurements/${row.id}`,
      })
    } else {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.status = 'MS_DAU_THAU_THAT_BAI'
      row.csvcMethod = 'DAU_THAU'
      row.returnReason = reason.trim()
      await row.save()
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Đấu thầu thất bại',
        message: `${outline.code}: ${reason.trim()}`,
        link: `/projects/procurements/${row.id}`,
      })
      await this.tellOwner(outline.ownerId, 'Đấu thầu thất bại', reason, row.id)
    }
    return this.serialize(row)
  }

  static async receive(id: number, userId: number) {
    const row = await ProjectProcurement.find(id)
    if (!row || row.status !== 'MS_CHO_NHAN') throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)
    await assertCnnv(userId, outline)
    row.status = 'MS_CHO_TC'
    row.receivedAt = DateTime.now()
    await row.save()
    await NotificationService.pushToPermission('project.budget_confirm', {
      type: 'PROJECT_UPDATE',
      title: 'Mua sắm chờ thanh toán',
      message: outline.code,
      link: `/projects/procurements/${row.id}`,
    })
    return this.serialize(row)
  }

  static async tcPay(id: number, userId: number, voucherNo: string, voucherDate: string, accept: boolean, reason: string) {
    await assertPerm(userId, 'project.budget_confirm')
    const row = await ProjectProcurement.find(id)
    if (!row || row.status !== 'MS_CHO_TC') throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)
    if (!accept) {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.status = 'MS_CHO_NHAN'
      row.returnReason = reason.trim()
      await row.save()
      return this.serialize(row)
    }
    const no = voucherNo.trim()
    const date = DateTime.fromISO(voucherDate)
    if (!no || !date.isValid) throw new Error('VOUCHER_REQUIRED')
    await db.transaction(async (trx) => {
      row.useTransaction(trx)
      row.status = 'MS_DONE'
      row.voucherNo = no
      row.voucherDate = date
      await row.save()
      await writeLedger(outline.id, row.lineCode, 'SPENT', Number(row.totalAmount), 'MS', row.id, userId, null, trx)
      if (row.lineCode === 'MUC_03') {
        const existed = await ProjectAsset.query({ client: trx }).where('procurement_id', row.id).first()
        if (!existed) {
          await ProjectAsset.createMany(
            (row.items || []).map((it) => ({
              projectOutlineId: outline.id,
              procurementId: row.id,
              name: it.name,
              quantity: String(it.qty),
              amount: it.amount,
              note: it.spec || null,
            })),
            { client: trx }
          )
        }
      }
    })
    return this.serialize(row)
  }

  private static parseItems(raw: unknown): ProcurementItem[] {
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('ITEMS_REQUIRED')
    return raw.map((item) => {
      const o = item as Record<string, unknown>
      const name = String(o.name || '').trim()
      const unit = String(o.unit || '').trim()
      const qty = Number(o.qty)
      const unitPrice = money(o.unitPrice ?? o.unit_price)
      if (!name || !unit || !Number.isFinite(qty) || qty <= 0) throw new Error('ITEMS_REQUIRED')
      return {
        name,
        unit,
        qty,
        unitPrice,
        amount: Math.round(qty * unitPrice),
        spec: String(o.spec || '').trim(),
      }
    })
  }

  private static async tellOwner(userId: number | null, title: string, message: string, id: number) {
    if (!userId) return
    await NotificationService.push(userId, {
      type: 'PROJECT_UPDATE',
      title,
      message,
      link: `/projects/procurements/${id}`,
    })
  }

  private static async onlyTc(userId: number, outline: Awaited<ReturnType<typeof loadOutline>>) {
    if (await isCnnv(userId, outline)) return false
    if (await hasPerm(userId, 'project.contract_manage')) return false
    if (await hasPerm(userId, 'project.procurement_handle')) return false
    return hasPerm(userId, 'project.budget_confirm')
  }

  private static async assertSee(userId: number, outline: Awaited<ReturnType<typeof loadOutline>>) {
    if (await isCnnv(userId, outline)) return
    if (
      (await hasPerm(userId, 'project.contract_manage')) ||
      (await hasPerm(userId, 'project.procurement_handle')) ||
      (await hasPerm(userId, 'project.budget_confirm')) ||
      (await hasPerm(userId, 'project.view'))
    ) {
      return
    }
    throw new Error('FORBIDDEN')
  }
}
