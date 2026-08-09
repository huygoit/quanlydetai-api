import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineBudgetConfirmation from '#models/project_outline_budget_confirmation'
import type { LdBudgetDecision } from '#models/project_outline_budget_confirmation'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'

/** Cảnh báo chênh lệch % so với kinh phí đề nghị */
export const BUDGET_DEVIATION_WARN_PERCENT = 20
/**
 * Ngưỡng kích hoạt bước HĐ xét duyệt kinh phí tăng cường (TBD nghiệp vụ).
 * Mặc định 500 triệu VNĐ.
 */
export const LARGE_BUDGET_THRESHOLD = 500_000_000
/** Cho phép mức KP = 0 (đề tài không cấp kinh phí) — mặc định tắt */
export const ALLOW_ZERO_APPROVED_BUDGET = false

export default class ProjectOutlineBudgetService {
  /** Pure — tỷ lệ chênh lệch; null nếu requested = 0 */
  static calcDeviationRate(proposed: number, requested: number): number | null {
    if (!requested || requested === 0) return null
    return Math.round((Math.abs(proposed - requested) / requested) * 10000) / 100
  }

  static needsDeviationWarning(proposed: number, requested: number): boolean {
    const rate = this.calcDeviationRate(proposed, requested)
    if (rate == null) {
      // requested = 0: cảnh báo đặc biệt nếu proposed > 0
      return proposed > 0
    }
    return rate > BUDGET_DEVIATION_WARN_PERCENT
  }

  static requiresLargeBudgetCouncil(amount: number, threshold = LARGE_BUDGET_THRESHOLD) {
    return amount >= threshold
  }

  static validatePositiveBudget(amount: number, allowZero = ALLOW_ZERO_APPROVED_BUDGET): string | null {
    if (Number.isNaN(amount)) return 'Mức kinh phí không hợp lệ.'
    if (amount < 0) return 'Mức kinh phí không được âm.'
    if (amount === 0 && !allowZero) {
      return 'Mức kinh phí phải > 0 (loại không cấp kinh phí chưa được bật).'
    }
    return null
  }

  static serialize(row: ProjectOutlineBudgetConfirmation, outline?: ProjectOutline | null) {
    const requested = Number(row.requestedBudgetSnapshot || 0)
    const pkh = row.pkhProposedBudget == null ? null : Number(row.pkhProposedBudget)
    const tc = row.tcConfirmedBudget == null ? null : Number(row.tcConfirmedBudget)
    const presentForLd = tc ?? pkh
    return {
      id: row.id,
      projectOutlineId: row.projectOutlineId,
      status: row.status,
      requestedBudgetSnapshot: requested,
      pkhProposedBudget: pkh,
      pkhNote: row.pkhNote,
      pkhProposedBy: row.pkhProposedBy,
      pkhProposedAt: row.pkhProposedAt?.toISO() ?? null,
      tcConfirmedBudget: tc,
      tcNote: row.tcNote,
      tcAdjusted: row.tcAdjusted,
      tcBy: row.tcBy,
      tcAt: row.tcAt?.toISO() ?? null,
      tcReturnReason: row.tcReturnReason,
      requiresLargeBudgetCouncil: row.requiresLargeBudgetCouncil,
      largeBudgetCouncilDone: row.largeBudgetCouncilDone,
      largeBudgetCouncilNote: row.largeBudgetCouncilNote,
      largeBudgetMinutesUrl: row.largeBudgetMinutesUrl,
      ldDecision: row.ldDecision,
      ldNote: row.ldNote,
      ldRejectReason: row.ldRejectReason,
      ldBy: row.ldBy,
      ldAt: row.ldAt?.toISO() ?? null,
      approvedBudget: row.approvedBudget == null ? null : Number(row.approvedBudget),
      module5OpenedAt: row.module5OpenedAt?.toISO() ?? null,
      version: row.version,
      deviationRate:
        presentForLd == null ? null : this.calcDeviationRate(presentForLd, requested),
      deviationWarning:
        presentForLd == null ? false : this.needsDeviationWarning(presentForLd, requested),
      requestedZeroException: requested === 0,
      largeBudgetThreshold: LARGE_BUDGET_THRESHOLD,
      outline: outline
        ? {
            id: outline.id,
            code: outline.code,
            title: outline.title,
            status: outline.status,
            ownerName: outline.ownerName,
            ownerUnit: outline.ownerUnit,
            requestedBudget: Number(outline.requestedBudget || 0),
            defenseConclusion: outline.defenseConclusion,
          }
        : undefined,
    }
  }

  static async getOrCreateDraft(outline: ProjectOutline) {
    if (
      !['CHO_XAC_NHAN_KP', 'CHO_TC_THAM_TRA', 'LDPD_PENDING'].includes(outline.status) &&
      outline.status !== 'SAN_SANG_THUC_HIEN' &&
      outline.status !== 'KHONG_PHE_DUYET'
    ) {
      // Cho phép mở bản ghi đã chốt để xem
      if (outline.activeBudgetConfirmationId) {
        return ProjectOutlineBudgetConfirmation.findOrFail(outline.activeBudgetConfirmationId)
      }
    }

    let row = outline.activeBudgetConfirmationId
      ? await ProjectOutlineBudgetConfirmation.find(outline.activeBudgetConfirmationId)
      : null

    if (!row) {
      row = await ProjectOutlineBudgetConfirmation.query()
        .where('project_outline_id', outline.id)
        .whereNotIn('status', ['LD_APPROVED', 'LD_REJECTED'])
        .orderBy('id', 'desc')
        .first()
    }

    if (!row) {
      row = await ProjectOutlineBudgetConfirmation.create({
        projectOutlineId: outline.id,
        status: 'DRAFT',
        requestedBudgetSnapshot: Number(outline.requestedBudget || 0),
        version: 1,
      })
      outline.activeBudgetConfirmationId = row.id
      await outline.save()
    }
    return row
  }

  static async listByScope(scope: 'pkh' | 'tc' | 'ld') {
    const statusMap: Record<string, string[]> = {
      pkh: ['CHO_XAC_NHAN_KP'],
      tc: ['CHO_TC_THAM_TRA'],
      ld: ['LDPD_PENDING'],
    }
    const outlineStatuses = statusMap[scope]
    const outlines = await ProjectOutline.query()
      .whereIn('status', outlineStatuses)
      .orderBy('updated_at', 'desc')
      .limit(200)

    const data = []
    for (const o of outlines) {
      const conf = await this.getOrCreateDraft(o)
      data.push(this.serialize(conf, o))
    }
    return data
  }

  /** PKH lưu / gửi đề xuất kinh phí → TC */
  static async pkhPropose(
    outline: ProjectOutline,
    actorId: number,
    payload: {
      proposedBudget: number
      note?: string | null
      sendToTc?: boolean
      largeBudgetCouncilDone?: boolean
      largeBudgetCouncilNote?: string | null
      largeBudgetMinutesUrl?: string | null
      expectedVersion?: number
    }
  ) {
    if (outline.status !== 'CHO_XAC_NHAN_KP') {
      throw new Error('Chỉ đề xuất kinh phí khi hồ sơ ở trạng thái chờ xác nhận kinh phí.')
    }

    const err = this.validatePositiveBudget(payload.proposedBudget)
    if (err) throw new Error(err)

    const row = await this.getOrCreateDraft(outline)
    if (['LD_APPROVED', 'LD_REJECTED', 'CONFIRMED', 'SENT_TO_TC'].includes(row.status)) {
      throw new Error(
        row.status === 'SENT_TO_TC'
          ? 'Đã gửi TC — chờ thẩm tra hoặc nhận trả lại.'
          : 'Hồ sơ đã qua bước thẩm tra/phê duyệt — không sửa đề xuất PKH.'
      )
    }
    if (
      payload.expectedVersion != null &&
      Number(payload.expectedVersion) !== Number(row.version)
    ) {
      throw new Error('Dữ liệu đã bị người khác cập nhật — vui lòng tải lại.')
    }

    const requires = this.requiresLargeBudgetCouncil(payload.proposedBudget)
    row.requestedBudgetSnapshot = Number(outline.requestedBudget || 0)
    row.pkhProposedBudget = payload.proposedBudget
    row.pkhNote = payload.note?.trim() || null
    row.pkhProposedBy = actorId
    row.pkhProposedAt = DateTime.now()
    row.requiresLargeBudgetCouncil = requires
    if (payload.largeBudgetCouncilDone !== undefined) {
      row.largeBudgetCouncilDone = !!payload.largeBudgetCouncilDone
    }
    if (payload.largeBudgetCouncilNote !== undefined) {
      row.largeBudgetCouncilNote = payload.largeBudgetCouncilNote?.trim() || null
    }
    if (payload.largeBudgetMinutesUrl !== undefined) {
      row.largeBudgetMinutesUrl = payload.largeBudgetMinutesUrl?.trim() || null
    }
    row.version = (row.version || 1) + 1

    if (payload.sendToTc) {
      if (requires && !row.largeBudgetCouncilDone) {
        throw new Error(
          `Kinh phí ≥ ${LARGE_BUDGET_THRESHOLD.toLocaleString('vi-VN')} đ — cần hoàn tất bước xét duyệt kinh phí tăng cường trước khi gửi TC.`
        )
      }
      row.status = 'SENT_TO_TC'
      const from = outline.status
      outline.status = 'CHO_TC_THAM_TRA'
      outline.activeBudgetConfirmationId = row.id
      await outline.save()
      await row.save()

      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        'PKH_SEND_BUDGET_TO_TC',
        from,
        'CHO_TC_THAM_TRA',
        {
          confirmationId: row.id,
          proposed: payload.proposedBudget,
          deviationWarning: this.needsDeviationWarning(
            payload.proposedBudget,
            Number(outline.requestedBudget || 0)
          ),
        }
      )

      await NotificationService.pushToPermission('project.budget_confirm', {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ chờ thẩm tra kinh phí',
        message: `${outline.code}: PKH đề xuất ${payload.proposedBudget.toLocaleString('vi-VN')} đ`,
        link: `/projects/budget-approvals/${outline.id}`,
      })
      await NotificationService.pushToPermission('project.liquidation', {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ chờ thẩm tra kinh phí',
        message: `${outline.code}: PKH đề xuất ${payload.proposedBudget.toLocaleString('vi-VN')} đ`,
        link: `/projects/budget-approvals/${outline.id}`,
      })
    } else {
      if (row.status === 'RETURNED_BY_TC' || row.status === 'LD_RETURNED') {
        row.status = 'DRAFT'
      } else if (row.status !== 'DRAFT') {
        row.status = 'DRAFT'
      }
      await row.save()
      outline.activeBudgetConfirmationId = row.id
      await outline.save()
      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        'PKH_SAVE_BUDGET_PROPOSAL',
        outline.status,
        outline.status,
        { confirmationId: row.id, proposed: payload.proposedBudget }
      )
    }

    return row
  }

  /** TC xác nhận / điều chỉnh / trả lại */
  static async tcAction(
    outline: ProjectOutline,
    actorId: number,
    payload: {
      action: 'CONFIRM' | 'RETURN'
      confirmedBudget?: number | null
      note?: string | null
      returnReason?: string | null
      expectedVersion?: number
    }
  ) {
    if (outline.status !== 'CHO_TC_THAM_TRA') {
      throw new Error('Hồ sơ không chờ TC thẩm tra — tải lại dữ liệu.')
    }
    const row = await this.getOrCreateDraft(outline)
    if (row.status !== 'SENT_TO_TC') {
      throw new Error('Phiếu kinh phí không ở trạng thái chờ TC.')
    }
    if (
      payload.expectedVersion != null &&
      Number(payload.expectedVersion) !== Number(row.version)
    ) {
      throw new Error('Dữ liệu đã bị người khác cập nhật — vui lòng tải lại.')
    }

    if (payload.action === 'RETURN') {
      const reason = (payload.returnReason || '').trim()
      if (reason.length < 5) throw new Error('Lý do trả lại PKH bắt buộc (≥ 5 ký tự).')
      row.status = 'RETURNED_BY_TC'
      row.tcReturnReason = reason
      row.tcNote = payload.note?.trim() || null
      row.tcBy = actorId
      row.tcAt = DateTime.now()
      row.version = (row.version || 1) + 1
      await row.save()

      const from = outline.status
      outline.status = 'CHO_XAC_NHAN_KP'
      await outline.save()

      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        'TC_RETURN_BUDGET',
        from,
        'CHO_XAC_NHAN_KP',
        { confirmationId: row.id, reason }
      )

      await NotificationService.pushToPermission('project.budget_propose', {
        type: 'PROJECT_UPDATE',
        title: 'TC trả lại đề xuất kinh phí',
        message: `${outline.code}: ${reason}`,
        link: `/projects/budget-approvals/${outline.id}`,
      })
      await NotificationService.pushToPermission('project.review', {
        type: 'PROJECT_UPDATE',
        title: 'TC trả lại đề xuất kinh phí',
        message: `${outline.code}: ${reason}`,
        link: `/projects/budget-approvals/${outline.id}`,
      })
      return row
    }

    // CONFIRM
    const amount =
      payload.confirmedBudget != null
        ? Number(payload.confirmedBudget)
        : Number(row.pkhProposedBudget)
    const err = this.validatePositiveBudget(amount)
    if (err) throw new Error(err)
    if (row.pkhProposedBudget == null) {
      throw new Error('Chưa có mức PKH đề xuất.')
    }
    if (row.requiresLargeBudgetCouncil && !row.largeBudgetCouncilDone) {
      throw new Error('Chưa hoàn tất xét duyệt kinh phí tăng cường.')
    }

    const note = (payload.note || '').trim()
    const adjusted = amount !== Number(row.pkhProposedBudget)
    if (adjusted && note.length < 5) {
      throw new Error('Khi điều chỉnh mức kinh phí cần nhập căn cứ (≥ 5 ký tự).')
    }

    row.tcConfirmedBudget = amount
    row.tcAdjusted = adjusted
    row.tcNote = note || null
    row.tcBy = actorId
    row.tcAt = DateTime.now()
    row.tcReturnReason = null
    row.status = 'CONFIRMED'
    row.version = (row.version || 1) + 1
    await row.save()

    const from = outline.status
    outline.status = 'LDPD_PENDING'
    outline.confirmedBudget = amount
    outline.activeBudgetConfirmationId = row.id
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'TC_CONFIRM_BUDGET',
      from,
      'LDPD_PENDING',
      {
        confirmationId: row.id,
        confirmed: amount,
        adjusted,
        deviationWarning: this.needsDeviationWarning(
          amount,
          Number(row.requestedBudgetSnapshot || 0)
        ),
      }
    )

    await NotificationService.pushToPermissions(
      ['project.outline_approve', 'project.approve', 'project.selection_approve'],
      {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ chờ Lãnh đạo phê duyệt',
        message: `${outline.code}: mức trình ${amount.toLocaleString('vi-VN')} đ`,
        link: `/projects/budget-approvals/${outline.id}`,
      }
    )
    return row
  }

  /** LĐ phê duyệt / không / trả xem xét lại */
  static async ldDecide(
    outline: ProjectOutline,
    actorId: number,
    payload: {
      decision: LdBudgetDecision
      note?: string | null
      rejectReason?: string | null
      returnTarget?: 'PKH' | 'TC'
      expectedVersion?: number
    }
  ) {
    if (outline.status === 'SAN_SANG_THUC_HIEN' && outline.module5Opened) {
      const row = await this.getOrCreateDraft(outline)
      return { row, outline, idempotent: true }
    }
    if (outline.status !== 'LDPD_PENDING') {
      throw new Error('Hồ sơ không chờ LĐ phê duyệt — tải lại dữ liệu.')
    }

    const row = await this.getOrCreateDraft(outline)
    if (row.status === 'LD_APPROVED') {
      return { row, outline, idempotent: true }
    }
    if (row.status !== 'CONFIRMED' && row.status !== 'LD_RETURNED') {
      if (row.status !== 'CONFIRMED') {
        throw new Error('Chưa có mức TC xác nhận để LĐ phê duyệt.')
      }
    }
    if (
      payload.expectedVersion != null &&
      Number(payload.expectedVersion) !== Number(row.version)
    ) {
      throw new Error('Dữ liệu đã bị người khác cập nhật — vui lòng tải lại.')
    }

    if (row.tcConfirmedBudget == null) {
      throw new Error('Thiếu mức kinh phí TC đã xác nhận — LĐ không nhập mức cấp.')
    }

    if (payload.decision === 'RETURN') {
      row.ldDecision = 'RETURN'
      row.ldNote = payload.note?.trim() || null
      row.ldBy = actorId
      row.ldAt = DateTime.now()
      row.status = 'LD_RETURNED'
      row.version = (row.version || 1) + 1
      await row.save()

      const target = payload.returnTarget || 'PKH'
      const from = outline.status
      const next = target === 'TC' ? 'CHO_TC_THAM_TRA' : 'CHO_XAC_NHAN_KP'
      if (target === 'TC') {
        row.status = 'SENT_TO_TC'
        await row.save()
      } else {
        row.status = 'LD_RETURNED'
        await row.save()
      }
      outline.status = next as ProjectOutline['status']
      await outline.save()

      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        'LD_RETURN_BUDGET',
        from,
        next,
        { confirmationId: row.id, target, note: payload.note }
      )
      await NotificationService.pushToPermission(
        target === 'TC' ? 'project.budget_confirm' : 'project.budget_propose',
        {
          type: 'PROJECT_UPDATE',
          title: 'LĐ yêu cầu xem xét lại kinh phí',
          message: `${outline.code}: ${payload.note || 'Cần xem xét lại'}`,
          link: `/projects/budget-approvals/${outline.id}`,
        }
      )
      return { row, outline, idempotent: false }
    }

    if (payload.decision === 'REJECT') {
      const reason = (payload.rejectReason || '').trim()
      if (reason.length < 5) throw new Error('Lý do không phê duyệt bắt buộc (≥ 5 ký tự).')
      row.ldDecision = 'REJECT'
      row.ldRejectReason = reason
      row.ldNote = payload.note?.trim() || null
      row.ldBy = actorId
      row.ldAt = DateTime.now()
      row.status = 'LD_REJECTED'
      row.version = (row.version || 1) + 1
      await row.save()

      const from = outline.status
      outline.status = 'KHONG_PHE_DUYET'
      await outline.save()

      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        'LD_REJECT_OUTLINE',
        from,
        'KHONG_PHE_DUYET',
        { confirmationId: row.id, reason }
      )
      await this.notifyOwner(outline, false, null, reason)
      return { row, outline, idempotent: false }
    }

    // APPROVE — chỉ một lần mở Module 5
    if (outline.module5Opened) {
      return { row, outline, idempotent: true }
    }

    const approved = Number(row.tcConfirmedBudget)
    row.ldDecision = 'APPROVE'
    row.ldNote = payload.note?.trim() || null
    row.ldBy = actorId
    row.ldAt = DateTime.now()
    row.approvedBudget = approved
    row.status = 'LD_APPROVED'
    row.module5OpenedAt = DateTime.now()
    row.version = (row.version || 1) + 1
    await row.save()

    const from = outline.status
    outline.status = 'SAN_SANG_THUC_HIEN'
    outline.approvedBudget = approved
    outline.confirmedBudget = approved
    outline.module5Opened = true
    outline.module5OpenedAt = row.module5OpenedAt
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'LD_APPROVE_OUTLINE',
      from,
      'SAN_SANG_THUC_HIEN',
      {
        confirmationId: row.id,
        approvedBudget: approved,
        module5Opened: true,
      }
    )

    await this.notifyOwner(outline, true, approved, null)
    await NotificationService.pushToPermission('project.review', {
      type: 'PROJECT_UPDATE',
      title: 'LĐ đã phê duyệt thuyết minh',
      message: `${outline.code}: ${approved.toLocaleString('vi-VN')} đ — mở Module 5`,
      link: `/projects/budget-approvals/${outline.id}`,
    })

    return { row, outline, idempotent: false }
  }

  static async notifyOwner(
    outline: ProjectOutline,
    approved: boolean,
    budget: number | null,
    reason: string | null
  ) {
    if (!outline.ownerId) return
    const title = approved
      ? 'Thuyết minh đã được phê duyệt'
      : 'Thuyết minh không được phê duyệt'
    const message = approved
      ? `${outline.code}: mức kinh phí ${budget?.toLocaleString('vi-VN') || '—'} đ. Hồ sơ sẵn sàng thực hiện (Module 5).`
      : `${outline.code}: ${reason || 'Không phê duyệt'}`
    await NotificationService.push(outline.ownerId, {
      type: 'PROJECT_UPDATE',
      title,
      message,
      link: `/projects/my`,
    })
    if (outline.ownerEmail) {
      await EmailLogService.logStubToUser(
        outline.ownerId,
        `[KH&CN] ${title} ${outline.code}`,
        message,
        'project_outline',
        outline.id
      )
    }
  }
}
