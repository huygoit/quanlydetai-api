import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ProjectContract from '#models/project_contract'
import ProjectBudgetLine from '#models/project_budget_line'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectProgressService from '#services/project_progress_service'
import NotificationService from '#services/notification_service'
import { BUDGET_LINE_CODES } from '#constants/module56'
import {
  calcRowTotal,
  type OutlineBudgetExpenseAmounts,
  type OutlineBudgetMatrix,
} from '#constants/outline_budget_matrix'
import {
  normalizeFundingRows,
  normalizeMilestoneRows,
} from '#constants/contract_draft_form'
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
      draftForm: ProjectContractService.readDraftForm(outline, row.mergePayload),
      canEditDraft: row.status === 'HOP_DONG_DRAFT',
    }
  }

  static workflow(row: ProjectContract) {
    return {
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

  /**
   * Lưu form dự thảo (thời gian, tiến độ, kinh phí) → merge Word + mẫu Admin + profile trường.
   */
  static async saveDraftForm(contractId: number, userId: number, body: Record<string, unknown>) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await ProjectContractService.findById(contractId)
    if (row.status !== 'HOP_DONG_DRAFT') throw new Error('BAD_STATUS')
    const outline = await loadOutline(row.projectOutlineId)

    const milestones = normalizeMilestoneRows(body.milestones)
    const funding = normalizeFundingRows(body.funding, Number(body.tongKinhPhi) || 0)
    const tongFunding = funding.reduce((s, r) => s + r.amount, 0)
    const tongKinhPhi =
      body.tongKinhPhi != null && body.tongKinhPhi !== ''
        ? Math.round(Number(body.tongKinhPhi) || 0)
        : tongFunding

    if (tongFunding > 0 && tongKinhPhi > 0 && tongFunding !== tongKinhPhi) {
      throw new Error('FUNDING_SUM_MISMATCH')
    }

    let payload = { ...(row.mergePayload || {}) }
    // Bổ sung lại biến từ thuyết minh + profile trường (không xóa phần form)
    const fresh = await ProjectContractService.buildMergePayload(outline)
    try {
      const SchoolOrgProfileService = (await import('#services/school_org_profile_service')).default
      Object.assign(fresh, await SchoolOrgProfileService.bm06PartyAVars())
    } catch {
      // thiếu profile → giữ trống Bên A
    }
    payload = {
      ...fresh,
      ...payload,
      ten_nhiem_vu: fresh.ten_nhiem_vu,
      ma_so_nhiem_vu: fresh.ma_so_nhiem_vu,
      chu_nhiem: fresh.chu_nhiem,
      don_vi_chu_nhiem: fresh.don_vi_chu_nhiem,
      // Liên hệ CNNV luôn lấy lại từ hồ sơ (tránh giữ chuỗi trống cũ)
      dien_thoai_chu_nhiem: fresh.dien_thoai_chu_nhiem,
      email_chu_nhiem: fresh.email_chu_nhiem,
      dia_chi_ben_b: fresh.dia_chi_ben_b,
      dien_thoai_ben_b: fresh.dien_thoai_ben_b,
      email_ben_b: fresh.email_ben_b,
      to_chuc_ben_b: fresh.to_chuc_ben_b,
      ten_ben_a: fresh.ten_ben_a,
      he_thong_dai_hoc: fresh.he_thong_dai_hoc,
      dai_dien_ben_a: fresh.dai_dien_ben_a,
      chuc_vu_ben_a: fresh.chuc_vu_ben_a,
      dia_chi_ben_a: fresh.dia_chi_ben_a,
      dien_thoai_ben_a: fresh.dien_thoai_ben_a,
      email_ben_a: fresh.email_ben_a,
      tai_khoan_ben_a: fresh.tai_khoan_ben_a,
      ngan_hang_ben_a: fresh.ngan_hang_ben_a,
      ma_so_thue_ben_a: fresh.ma_so_thue_ben_a,
      chuc_vu_dai_dien_ben_a: fresh.chuc_vu_dai_dien_ben_a,
    }
    payload = ProjectContractService.applyDraftFormToPayload(payload, {
      soThang: body.soThang as string | number | null,
      ngayBatDau: body.ngayBatDau as string | null,
      ngayKetThuc: body.ngayKetThuc as string | null,
      tongKinhPhi,
      milestones,
      funding,
    })

    const saved = await ProjectContractService.persistDocx(outline, row, payload, userId)
    await this.ensureBudgetLinesForSubmit(outline.id, tongKinhPhi || tongFunding)
    return this.detail(saved.id, userId)
  }

  /**
   * Đảm bảo đủ danh mục khoản chi (cùng mã thuyết minh) — tổng = KP.
   * Đổ 1–1 từ ma trận TM; lệch làm tròn cộng vào THU_LAO.
   */
  private static async ensureBudgetLinesForSubmit(outlineId: number, total: number) {
    const lines = await ProjectBudgetLine.query()
      .where('project_outline_id', outlineId)
      .whereIn('code', [...BUDGET_LINE_CODES])
    const sum = lines.reduce((s, l) => s + Number(l.amount || 0), 0)
    if (lines.length >= BUDGET_LINE_CODES.length && sum === total && total > 0) return

    const outline = await loadOutline(outlineId)
    const fromMatrix = this.amountsFromBudgetMatrix(outline.budgetMatrix)
    let mappedSum = BUDGET_LINE_CODES.reduce((s, c) => s + (fromMatrix.get(c) || 0), 0)
    const target = Math.max(0, Math.round(total))
    if (mappedSum <= 0) {
      fromMatrix.set('THU_LAO', target)
    } else if (mappedSum !== target) {
      // Tỷ lệ hóa theo tổng KP hợp đồng (tránh cộng lệch làm âm một mục)
      const ratio = target / mappedSum
      for (const code of BUDGET_LINE_CODES) {
        fromMatrix.set(code, Math.round((fromMatrix.get(code) || 0) * ratio))
      }
      mappedSum = BUDGET_LINE_CODES.reduce((s, c) => s + (fromMatrix.get(c) || 0), 0)
      fromMatrix.set(
        'THU_LAO',
        Math.max(0, (fromMatrix.get('THU_LAO') || 0) + (target - mappedSum))
      )
    }

    await db.transaction(async (trx) => {
      await ProjectBudgetLine.query({ client: trx }).where('project_outline_id', outlineId).delete()
      await ProjectBudgetLine.createMany(
        BUDGET_LINE_CODES.map((code) => ({
          projectOutlineId: outlineId,
          code,
          amount: fromMatrix.get(code) || 0,
        })),
        { client: trx }
      )
    })
  }

  /** Cộng ma trận TM theo đúng mã cột (đã khớp danh mục hợp đồng). */
  private static amountsFromBudgetMatrix(matrix: unknown): Map<string, number> {
    const out = new Map<string, number>()
    for (const code of BUDGET_LINE_CODES) out.set(code, 0)
    if (!matrix || typeof matrix !== 'object') return out

    const m = matrix as OutlineBudgetMatrix
    for (const key of ['STATE_LUMP', 'STATE_NON_LUMP', 'NON_STATE'] as const) {
      const row = (m[key] || {}) as OutlineBudgetExpenseAmounts
      const { amounts } = calcRowTotal(row)
      for (const code of BUDGET_LINE_CODES) {
        const n = Math.round(Number(amounts[code] || 0))
        if (n > 0) out.set(code, (out.get(code) || 0) + n)
      }
    }
    return out
  }

  static async submitToCnnv(contractId: number, userId: number) {
    await assertPerm(userId, 'project.contract_manage')
    const row = await this.must(contractId, 'HOP_DONG_DRAFT')
    const outline = await loadOutline(row.projectOutlineId)
    assertReady(outline)
    const draft = ProjectContractService.readDraftForm(outline, row.mergePayload)
    await this.ensureBudgetLinesForSubmit(outline.id, draft.tongKinhPhi)
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

  /**
   * BGH ký → tự phát hành + Đã ký (không qua bước chờ phát hành / CNNV ký).
   * Mở triển khai ngay.
   */
  static async bghSign(contractId: number, userId: number) {
    await assertPerm(userId, 'project.outline_approve')
    const row = await ProjectContract.find(contractId)
    if (!row) throw new Error('CONTRACT_NOT_FOUND')
    // Cho phép hoàn tất cả hồ sơ đang chờ BGH hoặc còn kẹt bước phát hành cũ
    if (row.status !== 'HOP_DONG_CHO_KY' && row.status !== 'HOP_DONG_CHO_PHAT_HANH') {
      throw new Error('BAD_CONTRACT_STATUS')
    }
    const outline = await loadOutline(row.projectOutlineId)
    const now = DateTime.now()
    const from = row.status
    const issueNo =
      String(row.issueNo || '').trim() ||
      String(row.contractNo || '').trim() ||
      `HD-${outline.code}`

    await db.transaction(async (trx) => {
      row.useTransaction(trx)
      outline.useTransaction(trx)
      row.status = 'HOP_DONG_DA_KY'
      row.bghSignedAt = row.bghSignedAt || now
      row.bghSignedBy = row.bghSignedBy || userId
      row.returnReason = null
      // Phát hành ngay khi BGH ký
      row.issueNo = issueNo
      row.publishedAt = now
      row.publishedBy = userId
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
      'CONTRACT_BGH_SIGN_PUBLISH',
      from,
      'HOP_DONG_DA_KY',
      { executionStatus: 'DANG_THUC_HIEN', issueNo, published: true }
    )
    await NotificationService.pushToPermission('project.contract_manage', {
      type: 'PROJECT_UPDATE',
      title: 'Hợp đồng đã phát hành & có hiệu lực',
      message: `${outline.code}: số ${issueNo} — BGH đã ký`,
      link: `/projects/contracts/${row.id}`,
    })
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Hợp đồng đã phát hành',
        message: `${outline.code}: số ${issueNo} — đang thực hiện`,
        link: `/projects/contracts/${row.id}`,
      })
    }
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

