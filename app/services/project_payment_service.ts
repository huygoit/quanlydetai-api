import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ProjectPaymentRequest from '#models/project_payment_request'
import { BUDGET_LINE_CODES, FILE_LIMIT, type BudgetLineCode, type YcktStatus } from '#constants/module56'
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

const OPEN = ['YCKT_DRAFT', 'YCKT_BS']

/**
 * BM.07 — tạm ứng ghi ADVANCE, thanh toán ghi SPENT (QD-02, QD-04).
 */
export default class ProjectPaymentService {
  static serialize(row: ProjectPaymentRequest) {
    return {
      id: row.id,
      projectOutlineId: row.projectOutlineId,
      kind: row.kind,
      lineCode: row.lineCode,
      amount: Number(row.amount || 0),
      detail: row.detail,
      bankAccount: row.bankAccount,
      bankName: row.bankName,
      attachments: row.attachments || [],
      status: row.status,
      overBudget: row.overBudget,
      returnReason: row.returnReason,
      voucherNo: row.voucherNo,
      voucherDate: row.voucherDate?.toISODate() ?? null,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }
  }

  static async list(outlineId: number, userId: number, status?: string) {
    const outline = await loadOutline(outlineId)
    await this.assertSee(userId, outline, status)
    const q = ProjectPaymentRequest.query().where('project_outline_id', outlineId).orderBy('id', 'desc')
    if (status) q.where('status', status)
    else if (await this.onlyTc(userId, outline)) q.where('status', 'YCKT_TC')
    const rows = await q
    return rows.map((r) => this.serialize(r))
  }

  static async save(userId: number, body: Record<string, unknown>, submit: boolean) {
    const outline = await loadOutline(Number(body.projectOutlineId || body.project_outline_id))
    assertReady(outline)
    assertExecution(outline, ['DANG_THUC_HIEN'])
    await assertCnnv(userId, outline)

    const id = Number(body.id || 0)
    let row = id ? await ProjectPaymentRequest.find(id) : null
    if (row && row.projectOutlineId !== outline.id) throw new Error('NOT_FOUND')
    if (row && !OPEN.includes(row.status)) throw new Error('BAD_STATUS')

    const kind = String(body.kind || '')
    if (kind !== 'TAM_UNG' && kind !== 'THANH_TOAN') throw new Error('INVALID_KIND')
    const lineCode = String(body.lineCode || body.line_code || '')
    if (!BUDGET_LINE_CODES.includes(lineCode as BudgetLineCode)) throw new Error('INVALID_BUDGET_CODE')
    const amount = money(body.amount)
    if (amount <= 0) throw new Error('INVALID_AMOUNT')
    const detail = String(body.detail || '').trim()
    const bankAccount = String(body.bankAccount || body.bank_account || '').trim()
    const bankName = String(body.bankName || body.bank_name || '').trim()
    if (!detail || !bankAccount || !bankName) throw new Error('FORM_INCOMPLETE')
    const attachments = parseFiles(body.attachments, {
      required: true,
      maxEach: FILE_LIMIT.payment,
    })

    const snap = await budgetSnapshot(outline.id)
    const line = snap.find((l) => l.code === lineCode)!
    const overBudget = amount > line.remaining

    if (!row) {
      row = new ProjectPaymentRequest()
      row.projectOutlineId = outline.id
      row.createdBy = userId
      row.status = 'YCKT_DRAFT'
    }
    row.kind = kind
    row.lineCode = lineCode
    row.amount = amount
    row.detail = detail
    row.bankAccount = bankAccount
    row.bankName = bankName
    row.attachments = attachments
    row.overBudget = overBudget
    if (submit) {
      row.status = 'YCKT_PKH'
      row.returnReason = null
    }
    await row.save()
    if (submit) {
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Yêu cầu tạm ứng/thanh toán',
        message: `${outline.code}: ${amount} — ${lineCode}${overBudget ? ' (vượt dự toán)' : ''}`,
        link: `/projects/payments/${row.id}`,
      })
    }
    return this.serialize(row)
  }

  static async pkhAct(id: number, userId: number, action: 'accept' | 'return' | 'reject', reason: string) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await this.must(id, ['YCKT_PKH'])
    const outline = await loadOutline(row.projectOutlineId)
    if (action !== 'accept' && action !== 'return' && action !== 'reject') throw new Error('BAD_STATUS')
    if (action === 'accept') {
      row.status = 'YCKT_TC'
      row.returnReason = null
      await row.save()
      await NotificationService.pushToPermission('project.budget_confirm', {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ chi chờ KH-TC',
        message: `${outline.code}`,
        link: `/projects/payments/${row.id}`,
      })
    } else {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.status = action === 'return' ? 'YCKT_BS' : 'YCKT_DRAFT'
      row.returnReason = reason.trim()
      await row.save()
      if (outline.ownerId) {
        await NotificationService.push(outline.ownerId, {
          type: 'PROJECT_UPDATE',
          title: 'Hồ sơ chi cần xử lý lại',
          message: reason.trim(),
          link: `/projects/payments/${row.id}`,
        })
      }
    }
    return this.serialize(row)
  }

  static async tcAct(
    id: number,
    userId: number,
    accept: boolean,
    voucherNo: string,
    voucherDate: string,
    reason: string
  ) {
    await assertPerm(userId, 'project.budget_confirm')
    const row = await this.must(id, ['YCKT_TC'])
    const outline = await loadOutline(row.projectOutlineId)
    if (!accept) {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.status = 'YCKT_PKH' as YcktStatus
      row.returnReason = reason.trim()
      await row.save()
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'KH-TC trả hồ sơ chi',
        message: `${outline.code}: ${reason.trim()}`,
        link: `/projects/payments/${row.id}`,
      })
      return this.serialize(row)
    }
    const no = voucherNo.trim()
    const date = DateTime.fromISO(voucherDate)
    if (!no || !date.isValid) throw new Error('VOUCHER_REQUIRED')
    await db.transaction(async (trx) => {
      row.useTransaction(trx)
      row.status = 'YCKT_DONE'
      row.voucherNo = no
      row.voucherDate = date
      row.returnReason = null
      await row.save()
      await writeLedger(
        outline.id,
        row.lineCode,
        row.kind === 'TAM_UNG' ? 'ADVANCE' : 'SPENT',
        Number(row.amount),
        'YCKT',
        row.id,
        userId,
        row.kind,
        trx
      )
    })
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Đã thanh toán',
        message: `${outline.code}: chứng từ ${no}`,
        link: `/projects/payments/${row.id}`,
      })
    }
    return this.serialize(row)
  }

  private static async must(id: number, statuses: string[]) {
    const row = await ProjectPaymentRequest.find(id)
    if (!row || !statuses.includes(row.status)) throw new Error('BAD_STATUS')
    return row
  }

  private static async onlyTc(userId: number, outline: Awaited<ReturnType<typeof loadOutline>>) {
    if (await isCnnv(userId, outline)) return false
    if (await hasPerm(userId, 'project.contract_manage')) return false
    return hasPerm(userId, 'project.budget_confirm')
  }

  private static async assertSee(
    userId: number,
    outline: Awaited<ReturnType<typeof loadOutline>>,
    _status?: string
  ) {
    if (await isCnnv(userId, outline)) return
    if (
      (await hasPerm(userId, 'project.contract_manage')) ||
      (await hasPerm(userId, 'project.budget_confirm')) ||
      (await hasPerm(userId, 'project.view'))
    ) {
      return
    }
    throw new Error('FORBIDDEN')
  }
}
