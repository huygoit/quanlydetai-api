import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ProjectContract from '#models/project_contract'
import ProjectBudgetLine from '#models/project_budget_line'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectProgressService from '#services/project_progress_service'
import NotificationService from '#services/notification_service'
import { BUDGET_LINE_CODES } from '#constants/module56'
import { BM06_TEMPLATE_VARIABLES } from '#constants/bm06_template_variables'
import { applyBm06Edits, isBm06EditableKey } from '#services/module56_rules'
import {
  assertCnnv,
  assertPerm,
  assertReady,
  hasPerm,
  isCnnv,
  iso,
  loadOutline,
} from '#services/module56_common'
import ProjectContractService from '#services/project_contract_service'

/**
 * US-05-01 phần ký: CNNV xác nhận nội dung → BGH → TC-HC phát hành → CNNV ký.
 * DANG_THUC_HIEN ghi trên nhiệm vụ, không ghi trên hợp đồng (QD-08).
 */
export default class ProjectContractFlowService {
  static async detail(contractId: number, userId: number) {
    const row = await ProjectContractService.findById(contractId)
    const outline = row.outline || (await loadOutline(row.projectOutlineId))
    if (!(await isCnnv(userId, outline)) && !(await this.canViewOffice(userId))) {
      throw new Error('FORBIDDEN')
    }
    return {
      ...ProjectContractService.serialize(row, outline),
      workflow: this.workflow(row),
      executionStatus: outline.executionStatus,
      roles: {
        canManage: await hasPerm(userId, 'project.contract_manage'),
        canCnnv: await isCnnv(userId, outline),
        canBgh: await hasPerm(userId, 'project.outline_approve'),
        canPublish: await hasPerm(userId, 'project.contract_publish'),
      },
      clauseFields: BM06_TEMPLATE_VARIABLES.map((item) => ({
        key: item.key,
        label: item.label,
        group: item.group,
        value: (row.mergePayload || {})[item.key] || '',
        editable: isBm06EditableKey(item.key) && row.status === 'HOP_DONG_DRAFT',
      })),
    }
  }

  static workflow(row: ProjectContract) {
    return {
      externalContractNo: row.externalContractNo,
      externalAgency: row.externalAgency,
      externalFileUrl: row.externalFileUrl,
      returnReason: row.returnReason,
      cnnvConfirmedAt: iso(row.cnnvConfirmedAt),
      bghSignedAt: iso(row.bghSignedAt),
      publishedAt: iso(row.publishedAt),
      issueNo: row.issueNo,
      cnnvSignedAt: iso(row.cnnvSignedAt),
      signedFileUrl: row.signedFileUrl,
      effectiveAt: iso(row.effectiveAt),
      signMode: row.signMode || 'ONLINE',
    }
  }

  /** Phòng KH chọn ký trên hệ thống hoặc ký bản giấy (bắt buộc file scan). */
  static async setSignMode(contractId: number, userId: number, mode: string) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await ProjectContractService.findById(contractId)
    if (row.status === 'HOP_DONG_DA_KY') throw new Error('BAD_CONTRACT_STATUS')
    const next = String(mode || '').trim().toUpperCase()
    if (next !== 'ONLINE' && next !== 'GIAY') throw new Error('INVALID_SIGN_MODE')
    row.signMode = next === 'GIAY' ? 'GIAY' : 'ONLINE'
    await row.save()
    return this.workflow(row)
  }

  static async saveExternal(contractId: number, userId: number, body: Record<string, unknown>) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await ProjectContractService.findById(contractId)
    row.externalContractNo = str(body.externalContractNo ?? body.external_contract_no)
    row.externalAgency = str(body.externalAgency ?? body.external_agency)
    row.externalFileUrl = str(body.externalFileUrl ?? body.external_file_url)
    await row.save()
    return this.workflow(row)
  }

  /** Phòng KH sửa điều khoản trên mẫu BM.06 khi còn dự thảo. */
  static async updateClauses(contractId: number, userId: number, body: Record<string, unknown>) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await ProjectContractService.findById(contractId)
    if (row.status !== 'HOP_DONG_DRAFT') throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)
    const fields = (body.fields && typeof body.fields === 'object' ? body.fields : body) as Record<string, unknown>
    const payload = applyBm06Edits(row.mergePayload || {}, fields)
    const saved = await ProjectContractService.persistDocx(outline, row, payload, userId)
    return this.detail(saved.id, userId)
  }

  static async submitToCnnv(contractId: number, userId: number) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await this.must(contractId, 'HOP_DONG_DRAFT')
    const outline = await loadOutline(row.projectOutlineId)
    assertReady(outline)
    const lines = await ProjectBudgetLine.query()
      .where('project_outline_id', outline.id)
      .whereIn('code', [...BUDGET_LINE_CODES])
    if (lines.length < BUDGET_LINE_CODES.length) throw new Error('BUDGET_LINES_INCOMPLETE')

    row.status = 'HOP_DONG_CHO_CNNV'
    row.returnReason = null
    row.cnnvConfirmedAt = null
    row.cnnvConfirmedBy = null
    await row.save()
    await this.syncOutline(outline, row.status, userId, 'CONTRACT_SUBMIT_CNNV')
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Hợp đồng chờ xác nhận nội dung',
        message: `${outline.code}: ${row.contractNo || ''}`,
        link: `/projects/contracts/${row.id}`,
      })
    }
    return ProjectContractService.serialize(row, outline)
  }

  static async cnnvConfirm(contractId: number, userId: number) {
    const row = await this.must(contractId, 'HOP_DONG_CHO_CNNV')
    const outline = await loadOutline(row.projectOutlineId)
    await assertCnnv(userId, outline)
    row.cnnvConfirmedAt = DateTime.now()
    row.cnnvConfirmedBy = userId
    row.returnReason = null
    await row.save()
    await NotificationService.pushToPermission('project.contract_manage', {
      type: 'PROJECT_UPDATE',
      title: 'CNNV đã xác nhận nội dung hợp đồng',
      message: `${outline.code}: có thể trình BGH`,
      link: `/projects/contracts/${row.id}`,
    })
    return ProjectContractService.serialize(row, outline)
  }

  static async cnnvReturn(contractId: number, userId: number, reason: string) {
    const row = await this.must(contractId, 'HOP_DONG_CHO_CNNV')
    const outline = await loadOutline(row.projectOutlineId)
    await assertCnnv(userId, outline)
    this.requireReason(reason)
    await this.backToDraft(row, outline, userId, reason, 'CONTRACT_CNNV_RETURN')
    return ProjectContractService.serialize(row, outline)
  }

  static async submitToBgh(contractId: number, userId: number) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await this.must(contractId, 'HOP_DONG_CHO_CNNV')
    if (!row.cnnvConfirmedAt) throw new Error('CNNV_NOT_CONFIRMED')
    const outline = await loadOutline(row.projectOutlineId)
    row.status = 'HOP_DONG_CHO_KY'
    await row.save()
    await this.syncOutline(outline, row.status, userId, 'CONTRACT_SUBMIT_BGH')
    await NotificationService.pushToPermission('project.outline_approve', {
      type: 'PROJECT_UPDATE',
      title: 'Hợp đồng chờ BGH ký',
      message: `${outline.code}: ${row.contractNo || ''}`,
      link: `/projects/contracts/${row.id}`,
    })
    return ProjectContractService.serialize(row, outline)
  }

  static async bghSign(contractId: number, userId: number) {
    await assertPerm(userId, 'project.outline_approve')
    const row = await this.must(contractId, 'HOP_DONG_CHO_KY')
    const outline = await loadOutline(row.projectOutlineId)
    row.status = 'HOP_DONG_CHO_PHAT_HANH'
    row.bghSignedAt = DateTime.now()
    row.bghSignedBy = userId
    row.returnReason = null
    await row.save()
    await this.syncOutline(outline, row.status, userId, 'CONTRACT_BGH_SIGN')
    await NotificationService.pushToPermission('project.contract_publish', {
      type: 'PROJECT_UPDATE',
      title: 'Hợp đồng chờ phát hành',
      message: `${outline.code}: BGH đã ký`,
      link: `/projects/contracts/${row.id}`,
    })
    return ProjectContractService.serialize(row, outline)
  }

  static async bghReturn(contractId: number, userId: number, reason: string) {
    await assertPerm(userId, 'project.outline_approve')
    const row = await this.must(contractId, 'HOP_DONG_CHO_KY')
    const outline = await loadOutline(row.projectOutlineId)
    this.requireReason(reason)
    await this.backToDraft(row, outline, userId, reason, 'CONTRACT_BGH_RETURN')
    return ProjectContractService.serialize(row, outline)
  }

  static async publish(contractId: number, userId: number, issueNo: string) {
    await assertPerm(userId, 'project.contract_publish')
    const row = await this.must(contractId, 'HOP_DONG_CHO_PHAT_HANH')
    const no = String(issueNo || '').trim()
    if (!no) throw new Error('ISSUE_NO_REQUIRED')
    const outline = await loadOutline(row.projectOutlineId)
    row.issueNo = no
    row.publishedAt = DateTime.now()
    row.publishedBy = userId
    await row.save()
    await ProjectOutlineService.writeAudit(outline.id, userId, 'CONTRACT_PUBLISHED', row.status, row.status, {
      issueNo: no,
    })
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Hợp đồng đã phát hành, chờ ký',
        message: `${outline.code}: số ${no}`,
        link: `/projects/contracts/${row.id}`,
      })
    }
    return ProjectContractService.serialize(row, outline)
  }

  static async cnnvSign(contractId: number, userId: number, signedFileUrl: string | null) {
    const row = await this.must(contractId, 'HOP_DONG_CHO_PHAT_HANH')
    if (!row.publishedAt) throw new Error('NOT_PUBLISHED')
    const outline = await loadOutline(row.projectOutlineId)
    await assertCnnv(userId, outline)
    if ((row.signMode || 'ONLINE') === 'GIAY' && !signedFileUrl) throw new Error('SIGNED_FILE_REQUIRED')

    const now = DateTime.now()
    await db.transaction(async (trx) => {
      row.useTransaction(trx)
      outline.useTransaction(trx)
      row.status = 'HOP_DONG_DA_KY'
      row.cnnvSignedAt = now
      row.cnnvSignedBy = userId
      row.signedFileUrl = signedFileUrl
      row.effectiveAt = now
      await row.save()
      outline.contractStatus = row.status
      outline.activeContractId = row.id
      outline.executionStatus = 'DANG_THUC_HIEN'
      await outline.save()
      await ProjectProgressService.ensurePeriods(outline, trx)
    })

    await ProjectOutlineService.writeAudit(
      outline.id,
      userId,
      'CONTRACT_EFFECTIVE',
      'HOP_DONG_CHO_PHAT_HANH',
      'HOP_DONG_DA_KY',
      { executionStatus: 'DANG_THUC_HIEN' }
    )
    await NotificationService.pushToPermission('project.contract_manage', {
      type: 'PROJECT_UPDATE',
      title: 'Hợp đồng có hiệu lực',
      message: `${outline.code} đang thực hiện`,
      link: `/projects/contracts/${row.id}`,
    })
    return ProjectContractService.serialize(row, outline)
  }

  private static async must(id: number, status: ProjectContract['status']) {
    const row = await ProjectContract.find(id)
    if (!row) throw new Error('CONTRACT_NOT_FOUND')
    if (row.status !== status) throw new Error('BAD_CONTRACT_STATUS')
    return row
  }

  private static requireReason(reason: string) {
    if (!String(reason || '').trim()) throw new Error('REASON_REQUIRED')
  }

  private static async backToDraft(
    row: ProjectContract,
    outline: Awaited<ReturnType<typeof loadOutline>>,
    userId: number,
    reason: string,
    action: string
  ) {
    const from = row.status
    row.status = 'HOP_DONG_DRAFT'
    row.returnReason = reason.trim()
    row.cnnvConfirmedAt = null
    row.cnnvConfirmedBy = null
    await row.save()
    await this.syncOutline(outline, row.status, userId, action, reason, from)
    await NotificationService.pushToPermission('project.contract_manage', {
      type: 'PROJECT_UPDATE',
      title: 'Hợp đồng được trả về dự thảo',
      message: `${outline.code}: ${reason.trim()}`,
      link: `/projects/contracts/${row.id}`,
    })
  }

  private static async syncOutline(
    outline: Awaited<ReturnType<typeof loadOutline>>,
    status: string,
    userId: number,
    action: string,
    note?: string,
    from?: string
  ) {
    const prev = from || outline.contractStatus
    outline.contractStatus = status
    await outline.save()
    await ProjectOutlineService.writeAudit(outline.id, userId, action, prev, status, note ? { note } : undefined)
  }

  private static async canViewOffice(userId: number) {
    return (
      (await hasPerm(userId, 'project.contract_manage')) ||
      (await hasPerm(userId, 'project.view')) ||
      (await hasPerm(userId, 'project.outline_approve')) ||
      (await hasPerm(userId, 'project.contract_publish')) ||
      (await hasPerm(userId, 'project.budget_confirm'))
    )
  }
}

function str(v: unknown) {
  const s = String(v ?? '').trim()
  return s || null
}
