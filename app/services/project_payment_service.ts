import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ProjectPaymentRequest from '#models/project_payment_request'
import ProjectProgressPeriod from '#models/project_progress_period'
import ProjectProgressReport from '#models/project_progress_report'
import { BUDGET_LINE_CODES, FILE_LIMIT, budgetLineLabel, type BudgetLineCode, type YcktStatus } from '#constants/module56'
import EmailLogService from '#services/email_log_service'
import NotificationService from '#services/notification_service'
import { buildPaymentReturnEmail } from '#utils/payment_advance_email'
import {
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
  remainingForAdvance,
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

  /** Chi tiết hồ sơ tạm ứng + báo cáo tiến độ kèm theo (để PKH đối chiếu). */
  static async show(id: number, userId: number) {
    const row = await ProjectPaymentRequest.find(id)
    if (!row) throw new Error('NOT_FOUND')
    const outline = await loadOutline(row.projectOutlineId)
    await this.assertSee(userId, outline)
    const periods = await ProjectProgressPeriod.query()
      .where('project_outline_id', outline.id)
      .orderBy('due_on', 'asc')
    const reports = await ProjectProgressReport.query().where('project_outline_id', outline.id)
    const progress = periods.map((p) => {
      const report = reports.find((r) => r.periodId === p.id) || null
      return {
        id: p.id,
        title: p.title,
        dueOn: p.dueOn.toISODate(),
        kind: p.kind,
        report: report
          ? {
              id: report.id,
              status: report.status,
              contentRows: report.contentRows || [],
              productRows: report.productRows || [],
              nextPlan: report.nextPlan,
              recommendation: report.recommendation,
              attachments: report.attachments || [],
              submittedAt: iso(report.submittedAt),
            }
          : null,
      }
    })
    return {
      payment: this.serialize(row),
      outline: {
        id: outline.id,
        code: outline.code,
        title: outline.title,
        ownerName: outline.ownerName,
        ownerUnit: outline.ownerUnit,
        activeContractId: outline.activeContractId,
        executionStatus: outline.executionStatus,
      },
      progress,
    }
  }

  static async save(userId: number, body: Record<string, unknown>, submit: boolean) {
    const outline = await loadOutline(Number(body.projectOutlineId || body.project_outline_id))
    assertReady(outline)
    assertExecution(outline, ['DANG_THUC_HIEN'])
    // Chỉ chủ nhiệm nhiệm vụ được tạo / nộp / sửa hồ sơ tạm ứng
    const isOwner = await isCnnv(userId, outline)
    if (!isOwner) throw new Error('FORBIDDEN')

    const kind = String(body.kind || 'TAM_UNG')
    if (kind !== 'TAM_UNG' && kind !== 'THANH_TOAN') throw new Error('INVALID_KIND')
    const detail = String(body.detail || '').trim()
    const bankAccount = String(body.bankAccount || body.bank_account || '').trim()
    const bankName = String(body.bankName || body.bank_name || '').trim()
    if (!detail || !bankAccount || !bankName) throw new Error('FORM_INCOMPLETE')
    const attachments = parseFiles(body.attachments, {
      required: submit,
      maxEach: FILE_LIMIT.payment,
    })

    // Form mới: nhiều dòng khoản chi → tạo nhiều phiếu cùng hồ sơ
    const rawLines = Array.isArray(body.lines) ? body.lines : null
    if (rawLines && !Number(body.id || 0)) {
      const lines = rawLines
        .map((x) => {
          if (!x || typeof x !== 'object') return null
          const o = x as Record<string, unknown>
          const lineCode = String(o.lineCode || o.line_code || o.code || '').trim()
          const amount = money(o.amount)
          if (!lineCode || amount <= 0) return null
          if (!BUDGET_LINE_CODES.includes(lineCode as BudgetLineCode)) {
            throw new Error('INVALID_BUDGET_CODE')
          }
          return { lineCode, amount }
        })
        .filter(Boolean) as { lineCode: string; amount: number }[]
      if (!lines.length) throw new Error('LINES_REQUIRED')

      const snap = await budgetSnapshot(outline.id)
      const created = await db.transaction(async (trx) => {
        const out: ProjectPaymentRequest[] = []
        for (const line of lines) {
          const remain = remainingForAdvance(snap, line.lineCode)
          const row = new ProjectPaymentRequest()
          row.useTransaction(trx)
          row.projectOutlineId = outline.id
          row.createdBy = userId
          row.status = submit ? 'YCKT_PKH' : 'YCKT_DRAFT'
          row.kind = kind
          row.lineCode = line.lineCode
          row.amount = line.amount
          row.detail = detail
          row.bankAccount = bankAccount
          row.bankName = bankName
          row.attachments = attachments
          row.overBudget = line.amount > remain
          row.returnReason = null
          await row.save()
          out.push(row)
        }
        return out
      })

      if (submit) {
        const tong = lines.reduce((s, l) => s + l.amount, 0)
        const firstId = created[0]?.id
        await NotificationService.pushToPermission('project.contract_manage', {
          type: 'PROJECT_UPDATE',
          title: 'Hồ sơ tạm ứng chờ duyệt',
          message: `${outline.code}: ${tong.toLocaleString('vi-VN')} đ — ${lines.length} khoản chi`,
          link: firstId
            ? `/projects/payments/${firstId}`
            : `/projects/contracts/${outline.activeContractId || ''}?tab=tamung`,
        })
      }
      return created.map((r) => this.serialize(r))
    }

    const id = Number(body.id || 0)
    let row = id ? await ProjectPaymentRequest.find(id) : null
    if (row && row.projectOutlineId !== outline.id) throw new Error('NOT_FOUND')
    if (row && !OPEN.includes(row.status)) throw new Error('BAD_STATUS')

    const lineCode = String(body.lineCode || body.line_code || '')
    if (!BUDGET_LINE_CODES.includes(lineCode as BudgetLineCode)) throw new Error('INVALID_BUDGET_CODE')
    const amount = money(body.amount)
    if (amount <= 0) throw new Error('INVALID_AMOUNT')

    const snap = await budgetSnapshot(outline.id)
    const overBudget = amount > remainingForAdvance(snap, lineCode)

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
        title: 'Hồ sơ tạm ứng chờ duyệt',
        message: `${outline.code}: ${amount.toLocaleString('vi-VN')} đ — ${budgetLineLabel(lineCode)}${overBudget ? ' (vượt dự toán)' : ''}`,
        link: `/projects/payments/${row.id}`,
      })
    }
    return this.serialize(row)
  }

  /** Xóa yêu cầu tạm ứng/thanh toán khi còn nháp hoặc cần bổ sung. */
  static async remove(id: number, userId: number) {
    const row = await ProjectPaymentRequest.find(id)
    if (!row) throw new Error('NOT_FOUND')
    if (!OPEN.includes(row.status)) throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)
    // Chỉ chủ nhiệm được xóa hồ sơ của mình
    if (!(await isCnnv(userId, outline))) throw new Error('FORBIDDEN')
    await row.delete()
    return { id }
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
        title: 'Hồ sơ tạm ứng đã được phòng Khoa học chấp thuận',
        message: `${outline.code}: xin vui lòng kiểm tra hồ sơ tạm ứng.`,
        link: `/projects/payments/${row.id}`,
      })
    } else {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      // Yêu cầu bổ sung → trả CNNV; từ chối → về nháp
      row.status = action === 'return' ? 'YCKT_BS' : 'YCKT_DRAFT'
      row.returnReason = reason.trim()
      await row.save()
      if (outline.ownerId) {
        const link = outline.activeContractId
          ? `/projects/contracts/${outline.activeContractId}?tab=tamung`
          : `/projects/payments/${row.id}`
        await NotificationService.push(outline.ownerId, {
          type: 'PROJECT_UPDATE',
          title:
            action === 'return'
              ? 'Hồ sơ tạm ứng cần bổ sung'
              : 'Hồ sơ tạm ứng bị từ chối',
          message: reason.trim(),
          link,
        })
        if (action === 'return') {
          const mail = buildPaymentReturnEmail({
            ownerName: outline.ownerName,
            code: outline.code,
            title: outline.title,
            amountLabel: `${Number(row.amount || 0).toLocaleString('vi-VN')} đ`,
            lineLabel: budgetLineLabel(row.lineCode),
            note: reason.trim(),
            paymentId: row.id,
            contractId: outline.activeContractId,
          })
          await EmailLogService.logStubToUser(
            outline.ownerId,
            mail.subject,
            mail.text,
            'payment_advance',
            row.id,
            mail.html
          )
        }
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
    const linkHoSo = `/projects/payments/${row.id}`
    const linkTamUng = outline.activeContractId
      ? `/projects/contracts/${outline.activeContractId}?tab=tamung`
      : linkHoSo

    // Từ chối thanh toán → YCKT_TU_CHOI, báo PKH + CNNV
    if (!accept) {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.status = 'YCKT_TU_CHOI' as YcktStatus
      row.returnReason = reason.trim()
      await row.save()
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ tạm ứng bị Phòng Tài chính từ chối',
        message: `${outline.code}: ${reason.trim()}`,
        link: linkHoSo,
      })
      if (outline.ownerId) {
        await NotificationService.push(outline.ownerId, {
          type: 'PROJECT_UPDATE',
          title: 'Hồ sơ tạm ứng bị từ chối thanh toán',
          message: `${outline.code}: ${reason.trim()}`,
          link: linkTamUng,
        })
      }
      return this.serialize(row)
    }

    // Đồng ý thanh toán → nhập số CT + ngày → YCKT_DONE
    const no = voucherNo.trim()
    const rawDate = String(voucherDate || '').trim()
    const date =
      DateTime.fromISO(rawDate).isValid
        ? DateTime.fromISO(rawDate)
        : DateTime.fromFormat(rawDate, 'dd/MM/yyyy')
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
        message: `${outline.code}: chứng từ ${no} ngày ${date.toFormat('dd/MM/yyyy')}`,
        link: linkTamUng,
      })
    }
    await NotificationService.pushToPermission('project.contract_manage', {
      type: 'PROJECT_UPDATE',
      title: 'Hồ sơ tạm ứng đã được thanh toán',
      message: `${outline.code}: chứng từ ${no}`,
      link: linkHoSo,
    })
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
