import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineVersion from '#models/project_outline_version'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutlineDefenseMinutesItem from '#models/project_outline_defense_minutes_item'
import PermissionService from '#services/permission_service'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectOutlineRevisionService from '#services/project_outline_revision_service'

/** TM_DUOC_DUYET */
export const STATUS_APPROVED = 'SAN_SANG_THUC_HIEN' as const
/** TM_TU_CHOI */
export const STATUS_REJECTED = 'KHONG_PHE_DUYET' as const
export const STATUS_CHO_BGH = 'CHO_BGH_DUYET_TM' as const
export const STATUS_CHO_HC = 'CHO_HC_PHAT_HANH_QD' as const

export default class ProjectOutlineFinalApprovalService {
  static async canBgh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.outline_approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_approve'))
    )
  }

  static async canHc(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.contract_publish')) ||
      (await PermissionService.userHasPermission(userId, 'project.liquidation'))
    )
  }

  static async canView(userId: number) {
    return (
      (await this.canBgh(userId)) ||
      (await this.canHc(userId)) ||
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  /** Đưa TM vào hàng chờ BGH sau khi thông qua / hoàn thiện xong cổng HĐ */
  static async enqueueForBgh(outline: ProjectOutline, actorId: number | null, meta?: Record<string, unknown>) {
    const from = outline.status
    outline.status = STATUS_CHO_BGH
    outline.revisionGateStatus = 'CHO_BGH'
    outline.bghDecisionNote = null
    outline.bghSignedAt = null
    outline.bghSignedBy = null
    outline.bghRejectReason = null
    outline.assignmentDecisionUrl = null
    outline.hcPublishedAt = null
    outline.hcPublishedBy = null
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'ENQUEUE_BGH_APPROVAL',
      from,
      STATUS_CHO_BGH,
      meta || null
    )

    await NotificationService.pushToPermission('project.outline_approve', {
      type: 'PROJECT_UPDATE',
      title: 'Thuyết minh chờ BGH phê duyệt',
      message: outline.code,
      link: `/projects/outline-approvals/${outline.id}`,
    })
    await NotificationService.pushToPermission('project.approve', {
      type: 'PROJECT_UPDATE',
      title: 'Thuyết minh chờ BGH phê duyệt',
      message: outline.code,
      link: `/projects/outline-approvals/${outline.id}`,
    })

    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ đang trình BGH phê duyệt',
        message: `${outline.code}: chờ Ban Giám hiệu xem xét.`,
        link: `/projects/outlines/form/${outline.id}`,
      })
    }
    return outline
  }

  static async list(scope: 'bgh' | 'hc' | 'done' = 'bgh') {
    let q = ProjectOutline.query().orderBy('updated_at', 'desc').limit(200)
    if (scope === 'bgh') q = q.where('status', STATUS_CHO_BGH)
    else if (scope === 'hc') q = q.where('status', STATUS_CHO_HC)
    else {
      q = q.whereIn('status', [STATUS_APPROVED, STATUS_REJECTED]).whereNotNull('bgh_signed_at')
    }
    const rows = await q
    return Promise.all(rows.map((o) => this.serializeListItem(o)))
  }

  static async serializeListItem(o: ProjectOutline) {
    const dossierLite = await this.loadAppraisalLite(o)
    return {
      id: o.id,
      code: o.code,
      title: o.title,
      status: o.status,
      ownerName: o.ownerName,
      ownerUnit: o.ownerUnit,
      requestedBudget: Number(o.requestedBudget || 0),
      approvedBudget: o.approvedBudget == null ? null : Number(o.approvedBudget),
      outlineFileUrl: o.outlineFileUrl,
      averageScore: dossierLite.averageScore,
      minutesFileUrl: dossierLite.minutesFileUrl,
      defenseConclusion: o.defenseConclusion,
      bghSignedAt: o.bghSignedAt?.toISO() ?? null,
      hcPublishedAt: o.hcPublishedAt?.toISO() ?? null,
      updatedAt: o.updatedAt?.toISO() ?? null,
    }
  }

  private static async loadAppraisalLite(outline: ProjectOutline) {
    const session = outline.activeDefenseSessionId
      ? await ProjectOutlineDefenseSession.find(outline.activeDefenseSessionId)
      : await ProjectOutlineDefenseSession.query()
          .where('project_outline_id', outline.id)
          .where('status', 'FINALIZED')
          .orderBy('id', 'desc')
          .first()

    const item = session
      ? await ProjectOutlineDefenseMinutesItem.query()
          .where('session_id', session.id)
          .where('project_outline_id', outline.id)
          .first()
      : null

    return {
      session,
      item,
      averageScore:
        item?.averageScore != null
          ? Number(item.averageScore)
          : session?.finalScore == null
            ? outline.reviewAverageScore == null
              ? null
              : Number(outline.reviewAverageScore)
            : Number(session.finalScore),
      minutesFileUrl: session?.minutesFileUrl ?? null,
      adjustmentRequirements:
        item?.adjustmentRequirements || session?.adjustmentRequirements || null,
      discussionNotes: session?.discussionNotes ?? null,
      councilConclusion: item?.councilConclusion ?? null,
    }
  }

  static async getDossier(outlineId: number) {
    const outline = await ProjectOutline.query()
      .where('id', outlineId)
      .preload('projectProposal')
      .preload('members', (q) => q.orderBy('member_order', 'asc'))
      .preload('budgetLines', (q) => q.orderBy('line_order', 'asc'))
      .first()
    if (!outline) return null

    const lite = await this.loadAppraisalLite(outline)
    const versions = await ProjectOutlineVersion.query()
      .where('project_outline_id', outline.id)
      .orderBy('version_no', 'asc')
    const versionMetas = await Promise.all(
      versions.map((v) => ProjectOutlineRevisionService.serializeVersion(v))
    )

    let revisionDiff = null as Awaited<
      ReturnType<typeof ProjectOutlineRevisionService.compareVersions>
    > | null
    if (outline.revisionBaselineVersionId || outline.revisionSubmittedVersionId) {
      revisionDiff = await ProjectOutlineRevisionService.compareVersions(
        outline.id,
        outline.revisionBaselineVersionId || undefined,
        outline.revisionSubmittedVersionId || undefined
      )
    }

    return {
      outline: {
        ...ProjectOutlineService.serialize(outline),
        bghDecisionNote: outline.bghDecisionNote,
        bghSignedAt: outline.bghSignedAt?.toISO() ?? null,
        bghSignedBy: outline.bghSignedBy,
        bghRejectReason: outline.bghRejectReason,
        assignmentDecisionUrl: outline.assignmentDecisionUrl,
        hcPublishedAt: outline.hcPublishedAt?.toISO() ?? null,
        hcPublishedBy: outline.hcPublishedBy,
      },
      appraisal: {
        averageScore: lite.averageScore,
        minutesFileUrl: lite.minutesFileUrl,
        discussionNotes: lite.discussionNotes,
        adjustmentRequirements: lite.adjustmentRequirements,
        councilConclusion: lite.councilConclusion,
        defenseConclusion: outline.defenseConclusion,
        sessionId: lite.session?.id ?? null,
        sessionCode: lite.session?.code ?? null,
      },
      finalFile: {
        url: outline.outlineFileUrl,
        fileName: ProjectOutlineRevisionService.tenFileTuUrl(outline.outlineFileUrl),
        fileSize: await ProjectOutlineRevisionService.doLuongFileTuUrl(outline.outlineFileUrl),
        label: 'BM.04 — thuyết minh cuối',
      },
      versions: versionMetas,
      revisionDiff,
      canApprove:
        outline.status === STATUS_CHO_BGH &&
        (outline.revisionGateStatus === 'CHO_BGH' || !outline.revisionGateStatus),
      canPublish: outline.status === STATUS_CHO_HC,
    }
  }

  static async bghApprove(
    outline: ProjectOutline,
    actorId: number,
    payload: { approvedBudget: number; note?: string | null }
  ) {
    if (!(await this.canBgh(actorId))) throw new Error('Không có quyền BGH phê duyệt.')
    if (outline.status === STATUS_CHO_HC && outline.bghSignedAt) {
      return { outline, idempotent: true }
    }
    if (outline.status !== STATUS_CHO_BGH) {
      throw new Error('Hồ sơ không ở trạng thái chờ BGH phê duyệt.')
    }
    const budget = Number(payload.approvedBudget)
    if (!Number.isFinite(budget) || budget <= 0) {
      throw new Error('Kinh phí được duyệt phải lớn hơn 0.')
    }

    const from = outline.status
    outline.approvedBudget = budget
    outline.confirmedBudget = budget
    outline.bghDecisionNote = payload.note?.trim() || null
    outline.bghRejectReason = null
    outline.bghSignedAt = DateTime.now()
    outline.bghSignedBy = actorId
    outline.revisionGateStatus = null
    outline.status = STATUS_CHO_HC
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'BGH_SIGN_APPROVE',
      from,
      STATUS_CHO_HC,
      { approvedBudget: budget, note: outline.bghDecisionNote }
    )

    await NotificationService.pushToPermission('project.contract_publish', {
      type: 'PROJECT_UPDATE',
      title: 'QĐ giao thực hiện chờ TC-HC phát hành',
      message: `${outline.code}: KP duyệt ${budget.toLocaleString('vi-VN')} đ`,
      link: `/projects/outline-approvals/${outline.id}`,
    })

    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'BGH đã ký phê duyệt — chờ phát hành QĐ',
        message: `${outline.code}: kinh phí ${budget.toLocaleString('vi-VN')} đ`,
        link: `/projects/outlines/form/${outline.id}`,
      })
    }

    return { outline, idempotent: false }
  }

  static async bghReject(outline: ProjectOutline, actorId: number, reason: string) {
    if (!(await this.canBgh(actorId))) throw new Error('Không có quyền BGH phê duyệt.')
    if (outline.status === STATUS_REJECTED && outline.bghRejectReason) {
      return { outline, idempotent: true }
    }
    if (outline.status !== STATUS_CHO_BGH) {
      throw new Error('Hồ sơ không ở trạng thái chờ BGH phê duyệt.')
    }
    const lyDo = reason.trim()
    if (lyDo.length < 5) throw new Error('Lý do từ chối tối thiểu 5 ký tự.')

    const from = outline.status
    outline.bghRejectReason = lyDo
    outline.bghDecisionNote = null
    outline.bghSignedAt = DateTime.now()
    outline.bghSignedBy = actorId
    outline.revisionGateStatus = null
    outline.status = STATUS_REJECTED
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'BGH_REJECT',
      from,
      STATUS_REJECTED,
      { reason: lyDo }
    )

    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Thuyết minh bị từ chối phê duyệt',
        message: `${outline.code}: ${lyDo}`,
        link: `/projects/outlines/form/${outline.id}`,
      })
      await EmailLogService.logStubToUser(
        outline.ownerId,
        `[KH&CN] Từ chối phê duyệt ${outline.code}`,
        `Kết quả: Không phê duyệt (TM_TU_CHOI)\nLý do: ${lyDo}`,
        'project_outline',
        outline.id
      )
    }
    return { outline, idempotent: false }
  }

  static async hcPublish(
    outline: ProjectOutline,
    actorId: number,
    payload?: { decisionFileUrl?: string | null }
  ) {
    if (!(await this.canHc(actorId))) throw new Error('Không có quyền TC-HC phát hành QĐ.')
    if (outline.status === STATUS_APPROVED && outline.module5Opened) {
      return { outline, idempotent: true }
    }
    if (outline.status !== STATUS_CHO_HC) {
      throw new Error('Hồ sơ không chờ TC-HC phát hành QĐ giao thực hiện.')
    }
    if (!outline.bghSignedAt || outline.approvedBudget == null) {
      throw new Error('Thiếu chữ ký BGH hoặc kinh phí được duyệt.')
    }

    const from = outline.status
    const budget = Number(outline.approvedBudget)
    outline.assignmentDecisionUrl =
      payload?.decisionFileUrl?.trim() || outline.assignmentDecisionUrl || null
    outline.hcPublishedAt = DateTime.now()
    outline.hcPublishedBy = actorId
    outline.status = STATUS_APPROVED
    outline.module5Opened = true
    outline.module5OpenedAt = DateTime.now()
    outline.confirmedBudget = budget
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'HC_PUBLISH_ASSIGNMENT_DECISION',
      from,
      STATUS_APPROVED,
      {
        approvedBudget: budget,
        decisionUrl: outline.assignmentDecisionUrl,
        module5Opened: true,
      }
    )

    const module5Link = `/projects/execution/${outline.id}`
    if (outline.ownerId) {
      const msg = `${outline.code}: đã phê duyệt. Kinh phí được duyệt ${budget.toLocaleString('vi-VN')} đ. Mở Module 5: ${module5Link}`
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Thuyết minh được phê duyệt — mở triển khai',
        message: msg,
        link: module5Link,
      })
      await EmailLogService.logStubToUser(
        outline.ownerId,
        `[KH&CN] Phê duyệt thuyết minh ${outline.code}`,
        `Kết quả: Được duyệt (TM_DUOC_DUYET)\nKinh phí được duyệt: ${budget.toLocaleString('vi-VN')} đ\nGhi chú BGH: ${outline.bghDecisionNote || '—'}\nLink Module 5: ${module5Link}`,
        'project_outline',
        outline.id
      )
    }

    await NotificationService.pushToPermission('project.contract_manage', {
      type: 'PROJECT_UPDATE',
      title: 'TM đã duyệt — có thể lập hợp đồng',
      message: outline.code,
      link: module5Link,
    })

    try {
      const { default: ProjectContractService } = await import('#services/project_contract_service')
      await ProjectContractService.generateDraft(outline, actorId, { silent: false })
    } catch (e) {
      console.error('[US-04 BGH] Sinh dự thảo hợp đồng thất bại:', (e as Error)?.message || e)
    }

    return { outline, idempotent: false }
  }
}
