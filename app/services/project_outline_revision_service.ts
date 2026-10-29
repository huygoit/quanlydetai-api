import { DateTime } from 'luxon'
import path from 'node:path'
import fs from 'node:fs/promises'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectOutlineBudgetLine from '#models/project_outline_budget_line'
import ProjectOutlineVersion from '#models/project_outline_version'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import ProjectOutlineDefenseMinutesItem from '#models/project_outline_defense_minutes_item'
import PermissionService from '#services/permission_service'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'
import { listUploadRootCandidates, normalizePublicBasePath, getUploadEnvConfig } from '#utils/upload_storage_helper'

/** Số ngày nhắc trước hạn chỉnh sửa */
export const REVISION_REMINDER_DAYS = 2
/** Giải trình bắt buộc tối thiểu */
export const MIN_REVISION_EXPLANATION = 100

/** Trạng thái sau khi CNNV nộp bản hoàn thiện (TM_CHO_PKH) */
export const STATUS_CHO_PKH = 'CHO_PKH_DUYET_TM' as const

export type OutlineSnapshot = {
  title: string
  field: string | null
  hostUnit: string | null
  requestedBudget: number
  applicationScope: string | null
  urgency: string | null
  detailedObjectives: string | null
  researchContent: string | null
  methodology: string | null
  summary: string | null
  milestones: unknown
  expectedProducts: unknown
  partnerUnits: unknown
  outlineFileUrl: string | null
  appendixFileUrl: string | null
  members: Array<{
    fullName: string
    role: string
    contributionPercent: number | null
  }>
  budgetLines: Array<{
    groupCode: string
    content: string
    amount: number
    note: string | null
  }>
}

export type FieldDiff = {
  field: string
  label: string
  before: string
  after: string
  kind: 'text' | 'number' | 'json' | 'file'
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Tên đề tài',
  field: 'Lĩnh vực',
  hostUnit: 'Đơn vị chủ trì',
  requestedBudget: 'Kinh phí đề nghị',
  applicationScope: 'Phạm vi ứng dụng',
  urgency: 'Tính cấp thiết',
  detailedObjectives: 'Mục tiêu chi tiết',
  researchContent: 'Nội dung nghiên cứu',
  methodology: 'Phương pháp',
  summary: 'Tóm tắt',
  milestones: 'Tiến độ / mốc',
  expectedProducts: 'Sản phẩm dự kiến',
  partnerUnits: 'Đơn vị phối hợp',
  outlineFileUrl: 'File thuyết minh',
  appendixFileUrl: 'File phụ lục',
  members: 'Thành viên',
  budgetLines: 'Kinh phí chi tiết',
}

export default class ProjectOutlineRevisionService {
  /** Pure — hết hạn chưa */
  static isPastDeadline(deadline: DateTime | null | undefined, now = DateTime.now()) {
    if (!deadline) return false
    return deadline < now
  }

  /** Pure — cần nhắc nếu còn ≤ N ngày và chưa quá hạn */
  static needsReminder(
    deadline: DateTime | null | undefined,
    reminderDays = REVISION_REMINDER_DAYS,
    now = DateTime.now()
  ) {
    if (!deadline || deadline < now) return false
    const daysLeft = deadline.diff(now, 'days').days
    return daysLeft <= reminderDays
  }

  static validateExplanation(text?: string | null) {
    const t = (text || '').trim()
    if (t.length < MIN_REVISION_EXPLANATION) {
      return `Giải trình bắt buộc, tối thiểu ${MIN_REVISION_EXPLANATION} ký tự (hiện ${t.length}).`
    }
    return null
  }

  static normalizeForCompare(v: unknown): string {
    if (v == null) return ''
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string') return v.trim()
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }

  /** Pure — so sánh snapshot form (không diff nội dung DOCX/PDF) */
  static diffSnapshots(before: OutlineSnapshot, after: OutlineSnapshot): FieldDiff[] {
    const keys = Object.keys(FIELD_LABELS) as Array<keyof OutlineSnapshot>
    const diffs: FieldDiff[] = []
    for (const key of keys) {
      const b = this.normalizeForCompare(before[key])
      const a = this.normalizeForCompare(after[key])
      if (b === a) continue
      let kind: FieldDiff['kind'] = 'text'
      if (key === 'requestedBudget') kind = 'number'
      else if (key === 'outlineFileUrl' || key === 'appendixFileUrl') kind = 'file'
      else if (
        key === 'milestones' ||
        key === 'expectedProducts' ||
        key === 'partnerUnits' ||
        key === 'members' ||
        key === 'budgetLines'
      ) {
        kind = 'json'
      }
      diffs.push({
        field: key,
        label: FIELD_LABELS[key] || key,
        before: b.length > 500 ? `${b.slice(0, 500)}…` : b,
        after: a.length > 500 ? `${a.slice(0, 500)}…` : a,
        kind,
      })
    }
    return diffs
  }

  static async buildSnapshot(outlineId: number): Promise<OutlineSnapshot> {
    const outline = await ProjectOutline.findOrFail(outlineId)
    const members = await ProjectOutlineMember.query()
      .where('project_outline_id', outlineId)
      .orderBy('member_order', 'asc')
    const budgetLines = await ProjectOutlineBudgetLine.query()
      .where('project_outline_id', outlineId)
      .orderBy('line_order', 'asc')

    return {
      title: outline.title,
      field: outline.field,
      hostUnit: outline.hostUnit,
      requestedBudget: Number(outline.requestedBudget || 0),
      applicationScope: outline.applicationScope,
      urgency: outline.urgency,
      detailedObjectives: outline.detailedObjectives,
      researchContent: outline.researchContent,
      methodology: outline.methodology,
      summary: outline.summary,
      milestones: outline.milestones || [],
      expectedProducts: outline.expectedProducts || [],
      partnerUnits: outline.partnerUnits || [],
      outlineFileUrl: outline.outlineFileUrl,
      appendixFileUrl: outline.appendixFileUrl,
      members: members.map((m) => ({
        fullName: m.fullName,
        role: m.role,
        contributionPercent: m.contributionPercent,
      })),
      budgetLines: budgetLines.map((l) => ({
        groupCode: l.groupCode,
        content: l.content,
        amount: Number(l.amount || 0),
        note: l.note,
      })),
    }
  }

  static async nextVersionNo(outlineId: number) {
    const last = await ProjectOutlineVersion.query()
      .where('project_outline_id', outlineId)
      .orderBy('version_no', 'desc')
      .first()
    return (last?.versionNo || 0) + 1
  }

  static tenFileTuUrl(url?: string | null) {
    if (!url?.trim()) return null
    try {
      const raw = decodeURIComponent(url.split('?')[0] || '')
      return path.basename(raw) || null
    } catch {
      return null
    }
  }

  /** Đọc dung lượng file trên đĩa (nếu tìm được); không có thì null */
  static async doLuongFileTuUrl(url?: string | null): Promise<number | null> {
    if (!url?.trim()) return null
    const { publicBasePath } = getUploadEnvConfig()
    const base = normalizePublicBasePath(publicBasePath)
    let relative = url.split('?')[0] || ''
    try {
      relative = decodeURIComponent(relative)
    } catch {
      /* giữ nguyên */
    }
    if (relative.startsWith(base)) relative = relative.slice(base.length)
    relative = relative.replace(/^\/+/, '')
    if (!relative) return null
    for (const root of listUploadRootCandidates()) {
      const full = path.join(root, relative)
      try {
        const st = await fs.stat(full)
        if (st.isFile()) return st.size
      } catch {
        /* thử root khác */
      }
    }
    return null
  }

  static async serializeVersion(v: ProjectOutlineVersion) {
    const snap = (v.snapshotJson || {}) as OutlineSnapshot & {
      outlineFileName?: string | null
      outlineFileSize?: number | null
    }
    const fileName =
      snap.outlineFileName || this.tenFileTuUrl(v.outlineFileUrl) || this.tenFileTuUrl(snap.outlineFileUrl)
    let fileSize =
      snap.outlineFileSize != null && Number.isFinite(Number(snap.outlineFileSize))
        ? Number(snap.outlineFileSize)
        : null
    if (fileSize == null) {
      fileSize = await this.doLuongFileTuUrl(v.outlineFileUrl || snap.outlineFileUrl)
    }
    const uploadedAt = v.lockedAt?.toISO() ?? v.createdAt?.toISO() ?? null
    return {
      id: v.id,
      projectOutlineId: v.projectOutlineId,
      versionNo: v.versionNo,
      parentVersionId: v.parentVersionId,
      versionType: v.versionType,
      status: v.status,
      outlineFileUrl: v.outlineFileUrl,
      appendixFileUrl: v.appendixFileUrl,
      fileName,
      fileSize,
      uploadedAt,
      explanation: v.explanation,
      defenseSessionId: v.defenseSessionId,
      createdBy: v.createdBy,
      lockedAt: v.lockedAt?.toISO() ?? null,
      createdAt: v.createdAt?.toISO() ?? null,
      snapshot: v.snapshotJson,
    }
  }

  /**
   * Khi HĐ kết luận có điều chỉnh — đóng băng bản đã đánh giá + mở kỳ chỉnh sửa.
   */
  static async openRevisionPeriod(
    outline: ProjectOutline,
    session: ProjectOutlineDefenseSession,
    actorId: number | null,
    opts?: { minutesUrl?: string | null; adjustmentRequirements?: string | null }
  ) {
    const existingBaseline = await ProjectOutlineVersion.query()
      .where('project_outline_id', outline.id)
      .where('version_type', 'BASELINE_AFTER_DEFENSE')
      .first()

    let baseline = existingBaseline
    if (!baseline) {
      const snapshot = await this.buildSnapshot(outline.id)
      const fileSize = await this.doLuongFileTuUrl(outline.outlineFileUrl)
      baseline = await ProjectOutlineVersion.create({
        projectOutlineId: outline.id,
        versionNo: await this.nextVersionNo(outline.id),
        parentVersionId: null,
        versionType: 'BASELINE_AFTER_DEFENSE',
        status: 'LOCKED',
        snapshotJson: {
          ...snapshot,
          outlineFileName: this.tenFileTuUrl(outline.outlineFileUrl),
          outlineFileSize: fileSize,
        },
        outlineFileUrl: outline.outlineFileUrl,
        appendixFileUrl: outline.appendixFileUrl,
        explanation: null,
        defenseSessionId: session.id,
        createdBy: actorId,
        lockedAt: DateTime.now(),
      })
    }

    outline.revisionBaselineVersionId = baseline.id
    outline.revisionDeadline = session.adjustmentDeadline
    outline.revisionExplanation = null
    outline.revisionSubmittedVersionId = null
    outline.revisionSubmittedAt = null
    outline.revisionReminderSentAt = null
    await outline.save()

    // Thông báo + mail biên bản cho CNĐT và mọi thành viên đề tài
    await this.notifyTeamNeedRevision(outline, session, opts)

    return baseline
  }

  /** Gửi thông báo in-app + email biên bản cho CNĐT và mọi thành viên có hồ sơ. */
  static async notifyTeamNeedRevision(
    outline: ProjectOutline,
    session: ProjectOutlineDefenseSession,
    opts?: { minutesUrl?: string | null; adjustmentRequirements?: string | null }
  ) {
    const han = outline.revisionDeadline
      ? outline.revisionDeadline.toFormat('dd/MM/yyyy')
      : session.adjustmentDeadline
        ? session.adjustmentDeadline.toFormat('dd/MM/yyyy')
        : 'hạn đã chọn'
    const yeuCau =
      (opts?.adjustmentRequirements || session.adjustmentRequirements || '').trim() ||
      'Xem chi tiết trên hệ thống / biên bản đính kèm.'
    const minutesUrl = (opts?.minutesUrl || session.minutesFileUrl || '').trim()
    const formLink = `/projects/outlines/form/${outline.id}`

    // Dùng memberUserIds (query trực tiếp user_id) — preload('profile') từng sót userId (bigint/Lucid).
    const userIds = [
      ...new Set(
        [outline.ownerId, ...(await ProjectOutlineService.memberUserIds(outline.id))]
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ]

    const title = 'Thuyết minh cần hoàn thiện sau thẩm định'
    const message = `${outline.code}: HĐ đề nghị hoàn thiện hồ sơ. Hạn ${han}. ${yeuCau}`

    if (userIds.length) {
      await NotificationService.pushMany(userIds, {
        type: 'PROJECT_UPDATE',
        title,
        message,
        link: formLink,
      })
    }

    const body = [
      `Kính gửi thành viên đề tài ${outline.code},`,
      '',
      `Hội đồng thẩm định đã kết luận: Đề nghị hoàn thiện hồ sơ.`,
      `Tên nhiệm vụ: ${outline.title}`,
      `Hạn hoàn thiện: ${han}`,
      '',
      'Nội dung cần hoàn thiện:',
      yeuCau,
      '',
      minutesUrl ? `Biên bản BM.05b: ${minutesUrl}` : 'Biên bản: xem trên hệ thống.',
      `Nộp thuyết minh hoàn thiện tại: ${formLink}`,
      '',
      'Trân trọng.',
    ].join('\n')

    for (const uid of userIds) {
      try {
        await EmailLogService.logStubToUser(
          uid,
          `[KH&CN] Biên bản thẩm định — cần hoàn thiện ${outline.code}`,
          body,
          'project_outline_defense_session',
          session.id
        )
      } catch (e) {
        console.warn('[notifyTeamNeedRevision] Gửi mail thất bại user', uid, e)
      }
    }
  }

  static async getRevisionContext(outline: ProjectOutline) {
    const session = outline.activeDefenseSessionId
      ? await ProjectOutlineDefenseSession.find(outline.activeDefenseSessionId)
      : await ProjectOutlineDefenseSession.query()
          .where('project_outline_id', outline.id)
          .where('status', 'FINALIZED')
          .orderBy('id', 'desc')
          .first()

    const minutesItem = session
      ? await ProjectOutlineDefenseMinutesItem.query()
          .where('session_id', session.id)
          .where('project_outline_id', outline.id)
          .first()
      : null

    const baseline = outline.revisionBaselineVersionId
      ? await ProjectOutlineVersion.find(outline.revisionBaselineVersionId)
      : await ProjectOutlineVersion.query()
          .where('project_outline_id', outline.id)
          .where('version_type', 'BASELINE_AFTER_DEFENSE')
          .orderBy('id', 'desc')
          .first()

    const submitted = outline.revisionSubmittedVersionId
      ? await ProjectOutlineVersion.find(outline.revisionSubmittedVersionId)
      : null

    const pastDeadline = this.isPastDeadline(outline.revisionDeadline)
    const remind = this.needsReminder(outline.revisionDeadline)
    const yeuCau =
      minutesItem?.adjustmentRequirements || session?.adjustmentRequirements || null
    const ketLuanItem = minutesItem?.councilConclusion || null

    // Chỉ trả userId Thư ký / Chủ tịch — tránh FE gọi API phiên HĐ (CNĐT bị 403).
    let thuKyUserId: number | null = null
    let chuTichUserId: number | null = null
    if (session) {
      const hdMembers = await ProjectOutlineDefenseMember.query()
        .where('session_id', session.id)
        .whereIn('role_in_council', ['THU_KY', 'CHU_TICH'])
        .select('user_id', 'role_in_council')
      for (const m of hdMembers) {
        const uid = Number(m.userId)
        if (!Number.isFinite(uid) || uid <= 0) continue
        if (m.roleInCouncil === 'THU_KY') thuKyUserId = uid
        if (m.roleInCouncil === 'CHU_TICH') chuTichUserId = uid
      }
    }

    return {
      status: outline.status,
      revisionGateStatus: outline.revisionGateStatus,
      revisionReturnReason: outline.revisionReturnReason,
      revisionDeadline: outline.revisionDeadline?.toISO() ?? null,
      pastDeadline,
      needsReminder: remind && outline.status === 'CHINH_SUA_TM',
      reminderDays: REVISION_REMINDER_DAYS,
      revisionExplanation: outline.revisionExplanation,
      adjustmentRequirements: yeuCau,
      discussionNotes: session?.discussionNotes ?? null,
      minutesNote: minutesItem?.note ?? null,
      councilConclusion: ketLuanItem,
      conclusion:
        ketLuanItem === 'HOAN_THIEN'
          ? 'THONG_QUA_DIEU_CHINH'
          : session?.conclusion ?? outline.defenseConclusion,
      minutesFileUrl: session?.minutesFileUrl ?? null,
      finalScore:
        minutesItem?.averageScore != null
          ? Number(minutesItem.averageScore)
          : session?.finalScore == null
            ? null
            : Number(session.finalScore),
      baselineVersion: baseline ? await this.serializeVersion(baseline) : null,
      submittedVersion: submitted ? await this.serializeVersion(submitted) : null,
      diffLimitNote:
        'So sánh trường form + metadata file (tên, dung lượng, ngày upload). Chưa diff nội dung DOCX/PDF.',
      minExplanationLength: MIN_REVISION_EXPLANATION,
      editable: outline.status === 'CHINH_SUA_TM' && !pastDeadline,
      canSubmit: outline.status === 'CHINH_SUA_TM' && !pastDeadline,
      thuKyUserId,
      chuTichUserId,
      /** Luồng mới: CNNV → PKH → HĐ → BGH */
      flowSteps: ['CHINH_SUA', 'PKH', 'HOI_DONG', 'BGH'] as const,
    }
  }

  static async saveRevisionDraft(
    outline: ProjectOutline,
    actorId: number,
    explanation?: string | null
  ) {
    if (outline.status !== 'CHINH_SUA_TM') {
      throw new Error('Chỉ chỉnh sửa khi hồ sơ ở trạng thái cần chỉnh sửa thuyết minh.')
    }
    if (this.isPastDeadline(outline.revisionDeadline)) {
      throw new Error('Đã quá hạn chỉnh sửa — liên hệ PKH gia hạn.')
    }
    if (explanation !== undefined) {
      outline.revisionExplanation = explanation?.trim() || null
    }
    await outline.save()
    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'SAVE_REVISION_DRAFT',
      'CHINH_SUA_TM',
      'CHINH_SUA_TM'
    )
    return outline
  }

  static async submitRevision(outline: ProjectOutline, actorId: number, explanation: string) {
    const daNop = ['CHO_PKH_DUYET_TM', 'CHO_HD_XAC_NHAN_TM', 'CHO_BGH_DUYET_TM']
    if (daNop.includes(outline.status) && outline.revisionSubmittedVersionId) {
      const ver = await ProjectOutlineVersion.find(outline.revisionSubmittedVersionId)
      return { outline, version: ver!, idempotent: true }
    }
    if (outline.status !== 'CHINH_SUA_TM') {
      throw new Error('Hồ sơ đã đổi trạng thái — vui lòng tải lại dữ liệu.')
    }
    if (this.isPastDeadline(outline.revisionDeadline)) {
      throw new Error('Đã quá hạn chỉnh sửa — không nộp được (liên hệ PKH gia hạn).')
    }
    const expErr = this.validateExplanation(explanation)
    if (expErr) throw new Error(expErr)
    if (!outline.outlineFileUrl?.trim()) {
      throw new Error('Cần upload file thuyết minh BM.04 mới trước khi nộp.')
    }

    const members = await ProjectOutlineService.loadMembers(outline.id)
    const budgetLines = await ProjectOutlineService.loadBudgetLines(outline.id)
    const formErrors = ProjectOutlineService.validateForSubmit(outline, members, budgetLines)
    if (formErrors.length) throw new Error(formErrors[0])

    let baselineId = outline.revisionBaselineVersionId
    if (!baselineId) {
      const baseline = await ProjectOutlineVersion.query()
        .where('project_outline_id', outline.id)
        .where('version_type', 'BASELINE_AFTER_DEFENSE')
        .first()
      baselineId = baseline?.id ?? null
    }

    const hoiDong = await this.hoiDongBaoVe(outline)
    if (!hoiDong.thuKy?.userId || !hoiDong.chuTich?.userId) {
      throw new Error(
        'Phiên thẩm định chưa có thư ký và chủ tịch có tài khoản — không thể chuyển duyệt sau PKH.'
      )
    }

    const snapshot = await this.buildSnapshot(outline.id)
    const fileSize = await this.doLuongFileTuUrl(outline.outlineFileUrl)
    const snapshotWithMeta = {
      ...snapshot,
      outlineFileName: this.tenFileTuUrl(outline.outlineFileUrl),
      outlineFileSize: fileSize,
    }
    const version = await ProjectOutlineVersion.create({
      projectOutlineId: outline.id,
      versionNo: await this.nextVersionNo(outline.id),
      parentVersionId: baselineId,
      versionType: 'REVISION_SUBMITTED',
      status: 'LOCKED',
      snapshotJson: snapshotWithMeta,
      outlineFileUrl: outline.outlineFileUrl,
      appendixFileUrl: outline.appendixFileUrl,
      explanation: explanation.trim(),
      defenseSessionId: outline.activeDefenseSessionId,
      createdBy: actorId,
      lockedAt: DateTime.now(),
    })

    const from = outline.status
    outline.revisionExplanation = explanation.trim()
    outline.revisionSubmittedVersionId = version.id
    outline.revisionSubmittedAt = DateTime.now()
    outline.revisionBaselineVersionId = baselineId
    outline.revisionGateStatus = 'CHO_PKH'
    outline.revisionReturnReason = null
    outline.status = STATUS_CHO_PKH
    outline.completionPercent = 100
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'SUBMIT_REVISION',
      from,
      STATUS_CHO_PKH,
      { versionId: version.id, parentVersionId: baselineId }
    )

    await NotificationService.pushToPermission('project.review', {
      type: 'PROJECT_UPDATE',
      title: 'Bản hoàn thiện chờ phòng KH',
      message: `${outline.code} — CNNV đã nộp theo BM.05b.`,
      link: `/projects/outlines/form/${outline.id}`,
    })

    if (outline.ownerEmail && outline.ownerId) {
      await EmailLogService.logStubToUser(
        outline.ownerId,
        `[KH&CN] Đã nộp bản hoàn thiện ${outline.code}`,
        `Thuyết minh ${outline.code} đã nộp cho phòng KH. Tiếp theo: PKH → Hội đồng → BGH phê duyệt.`,
        'project_outline',
        outline.id
      )
    }

    return { outline, version, idempotent: false }
  }

  /** Phòng KH duyệt trước, rồi chuyển hội đồng (Thư ký → Chủ tịch). */
  static async pkhReviewRevision(
    outline: ProjectOutline,
    actorId: number,
    accept: boolean,
    reason: string
  ) {
    const duoc =
      (await PermissionService.userHasPermission(actorId, 'project.review')) ||
      (await PermissionService.userHasPermission(actorId, 'project.selection_manage'))
    if (!duoc) throw new Error('Không có quyền duyệt bản hoàn thiện.')
    if (outline.status !== 'CHO_PKH_DUYET_TM' || outline.revisionGateStatus !== 'CHO_PKH') {
      throw new Error('Hồ sơ không chờ phòng KH duyệt bản hoàn thiện.')
    }
    if (!accept) return this.traLaiBanHoanThien(outline, actorId, reason.trim(), 'REVISION_PKH_RETURN')

    const hoiDong = await this.hoiDongBaoVe(outline)
    if (!hoiDong.thuKy?.userId) {
      throw new Error('Phiên thẩm định thiếu thư ký — không chuyển hội đồng được.')
    }

    const from = outline.status
    outline.revisionGateStatus = 'CHO_THU_KY'
    outline.status = 'CHO_HD_XAC_NHAN_TM'
    await outline.save()
    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'REVISION_PKH_OK',
      from,
      'CHO_HD_XAC_NHAN_TM'
    )
    await NotificationService.push(hoiDong.thuKy.userId, {
      type: 'PROJECT_UPDATE',
      title: 'Bản hoàn thiện chờ thư ký xác nhận',
      message: `${outline.code} — PKH đã duyệt, cần hội đồng xác nhận.`,
      link: `/projects/outlines/form/${outline.id}`,
    })
    return outline
  }

  /** Thư ký rồi chủ tịch — chủ tịch được duyệt cả khi đang chờ thư ký (nhảy thẳng BGH). */
  static async confirmCouncil(
    outline: ProjectOutline,
    actorId: number,
    accept: boolean,
    reason: string
  ) {
    if (outline.status !== 'CHO_HD_XAC_NHAN_TM') {
      throw new Error('Hồ sơ không chờ hội đồng xác nhận bản hoàn thiện.')
    }
    const hoiDong = await this.hoiDongBaoVe(outline)
    const note = reason.trim()
    const uid = Number(actorId)
    const thuKyUid = hoiDong.thuKy?.userId != null ? Number(hoiDong.thuKy.userId) : null
    const chuTichUid = hoiDong.chuTich?.userId != null ? Number(hoiDong.chuTich.userId) : null
    const laThuKy = thuKyUid != null && thuKyUid === uid
    const laChuTich = chuTichUid != null && chuTichUid === uid

    if (outline.revisionGateStatus === 'CHO_THU_KY') {
      // Chủ tịch được duyệt luôn (bỏ qua bước thư ký) → BGH
      if (laChuTich) {
        if (!accept) return this.traLaiBanHoanThien(outline, actorId, note, 'REVISION_CHAIR_RETURN')
        await ProjectOutlineService.writeAudit(
          outline.id,
          actorId,
          'REVISION_CHAIR_OK',
          outline.status,
          'CHO_BGH_DUYET_TM',
          { skippedSecretary: true }
        )
        const FinalApproval = (await import('#services/project_outline_final_approval_service')).default
        await FinalApproval.enqueueForBgh(outline, actorId, { via: 'REVISION_COUNCIL' })
        return outline
      }
      if (!laThuKy) {
        throw new Error('Chỉ thư ký hoặc chủ tịch hội đồng của phiên này được xác nhận.')
      }
      if (!accept) return this.traLaiBanHoanThien(outline, actorId, note, 'REVISION_SECRETARY_RETURN')
      outline.revisionGateStatus = 'CHO_CHU_TICH'
      await outline.save()
      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        'REVISION_SECRETARY_OK',
        'CHO_HD_XAC_NHAN_TM',
        'CHO_HD_XAC_NHAN_TM'
      )
      if (chuTichUid) {
        await NotificationService.push(chuTichUid, {
          type: 'PROJECT_UPDATE',
          title: 'Bản hoàn thiện chờ chủ tịch xác nhận',
          message: outline.code,
          link: `/projects/outlines/form/${outline.id}`,
        })
      }
      return outline
    }
    if (outline.revisionGateStatus === 'CHO_CHU_TICH') {
      if (!laChuTich) {
        throw new Error('Chỉ chủ tịch hội đồng của phiên này được xác nhận.')
      }
      if (!accept) return this.traLaiBanHoanThien(outline, actorId, note, 'REVISION_CHAIR_RETURN')
      await ProjectOutlineService.writeAudit(
        outline.id,
        actorId,
        'REVISION_CHAIR_OK',
        outline.status,
        'CHO_BGH_DUYET_TM'
      )
      const FinalApproval = (await import('#services/project_outline_final_approval_service')).default
      await FinalApproval.enqueueForBgh(outline, actorId, { via: 'REVISION_COUNCIL' })
      return outline
    }
    throw new Error('Hồ sơ đã đổi trạng thái — vui lòng tải lại dữ liệu.')
  }

  private static async hoiDongBaoVe(outline: ProjectOutline) {
    const sessionId = outline.activeDefenseSessionId
    if (!sessionId) return { thuKy: null, chuTich: null }
    const members = await ProjectOutlineDefenseMember.query().where('session_id', sessionId)
    return {
      thuKy: members.find((m) => m.roleInCouncil === 'THU_KY') || null,
      chuTich: members.find((m) => m.roleInCouncil === 'CHU_TICH') || null,
    }
  }

  private static async traLaiBanHoanThien(
    outline: ProjectOutline,
    actorId: number,
    reason: string,
    action: string
  ) {
    if (reason.length < 5) throw new Error('Cần nhập lý do trả lại (tối thiểu 5 ký tự).')
    const from = outline.status
    outline.status = 'CHINH_SUA_TM'
    outline.revisionGateStatus = null
    outline.revisionReturnReason = reason
    await outline.save()
    await ProjectOutlineService.writeAudit(outline.id, actorId, action, from, 'CHINH_SUA_TM', { reason })
    const userIds = [
      ...new Set(
        [outline.ownerId, ...(await ProjectOutlineService.memberUserIds(outline.id))]
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ]
    if (userIds.length) {
      await NotificationService.pushMany(userIds, {
        type: 'PROJECT_UPDATE',
        title: 'Bản hoàn thiện bị trả lại',
        message: `${outline.code}: ${reason}`,
        link: `/projects/outlines/form/${outline.id}`,
      })
    }
    return outline
  }

  static async extendDeadline(
    outline: ProjectOutline,
    actorId: number,
    newDeadlineIso: string,
    reason: string
  ) {
    if (outline.status !== 'CHINH_SUA_TM') {
      throw new Error('Chỉ gia hạn khi hồ sơ đang chỉnh sửa thuyết minh.')
    }
    const due = DateTime.fromISO(newDeadlineIso)
    if (!due.isValid) throw new Error('Deadline không hợp lệ.')
    if (due <= DateTime.now()) throw new Error('Hạn mới phải ở tương lai.')

    const old = outline.revisionDeadline?.toISO() ?? null
    outline.revisionDeadline = due.endOf('day')
    outline.revisionReminderSentAt = null
    await outline.save()

    // Đồng bộ session nếu còn
    if (outline.activeDefenseSessionId) {
      const session = await ProjectOutlineDefenseSession.find(outline.activeDefenseSessionId)
      if (session) {
        session.adjustmentDeadline = outline.revisionDeadline
        await session.save()
      }
    }

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'EXTEND_REVISION_DEADLINE',
      'CHINH_SUA_TM',
      'CHINH_SUA_TM',
      { oldDeadline: old, newDeadline: due.toISO(), reason }
    )

    const userIds = [
      ...new Set(
        [outline.ownerId, ...(await ProjectOutlineService.memberUserIds(outline.id))]
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ]
    if (userIds.length) {
      await NotificationService.pushMany(userIds, {
        type: 'PROJECT_UPDATE',
        title: 'Gia hạn chỉnh sửa thuyết minh',
        message: `${outline.code}: hạn mới ${due.toFormat('dd/MM/yyyy')}. Lý do: ${reason}`,
        link: `/projects/outlines/form/${outline.id}`,
      })
    }
    return outline
  }

  static async compareVersions(outlineId: number, fromVersionId?: number, toVersionId?: number) {
    const baseline =
      (fromVersionId ? await ProjectOutlineVersion.find(fromVersionId) : null) ||
      (await ProjectOutlineVersion.query()
        .where('project_outline_id', outlineId)
        .where('version_type', 'BASELINE_AFTER_DEFENSE')
        .orderBy('id', 'desc')
        .first())

    let afterSnap: OutlineSnapshot
    let afterMeta: Record<string, unknown> | null = null

    if (toVersionId) {
      const ver = await ProjectOutlineVersion.findOrFail(toVersionId)
      afterSnap = ver.snapshotJson as OutlineSnapshot
      afterMeta = await this.serializeVersion(ver)
    } else {
      afterSnap = await this.buildSnapshot(outlineId)
      const currentUrl = afterSnap.outlineFileUrl
      afterMeta = {
        id: 0,
        projectOutlineId: outlineId,
        versionNo: 0,
        parentVersionId: baseline?.id ?? null,
        versionType: 'CURRENT',
        status: 'WORKING',
        outlineFileUrl: currentUrl,
        appendixFileUrl: afterSnap.appendixFileUrl,
        fileName: this.tenFileTuUrl(currentUrl),
        fileSize: await this.doLuongFileTuUrl(currentUrl),
        uploadedAt: null,
        explanation: null,
        defenseSessionId: null,
        createdBy: null,
        lockedAt: null,
        createdAt: null,
        snapshot: afterSnap,
      }
    }

    if (!baseline) {
      return {
        diffs: [],
        baseline: null,
        after: afterMeta,
        fileDiff: null,
        diffLimitNote:
          'Chưa có bản gốc sau thẩm định. Chỉ hiển thị bản hiện tại. Không diff DOCX/PDF.',
      }
    }

    const before = baseline.snapshotJson as OutlineSnapshot
    const baselineMeta = await this.serializeVersion(baseline)
    const fileDiff = {
      before: {
        fileName: baselineMeta.fileName,
        fileSize: baselineMeta.fileSize,
        uploadedAt: baselineMeta.uploadedAt,
        url: baselineMeta.outlineFileUrl,
      },
      after: {
        fileName:
          (afterMeta?.fileName as string | null | undefined) ??
          this.tenFileTuUrl(afterSnap.outlineFileUrl),
        fileSize:
          (afterMeta?.fileSize as number | null | undefined) ??
          (await this.doLuongFileTuUrl(afterSnap.outlineFileUrl)),
        uploadedAt: (afterMeta?.uploadedAt as string | null | undefined) ?? null,
        url: afterSnap.outlineFileUrl,
      },
    }

    return {
      diffs: this.diffSnapshots(before, afterSnap),
      baseline: baselineMeta,
      after: afterMeta,
      fileDiff,
      diffLimitNote:
        'So sánh trường form + metadata file (tên, dung lượng, ngày). Chưa hỗ trợ diff nội dung DOCX/PDF.',
    }
  }

  /** Gửi nhắc nếu gần deadline (có thể gọi từ cron / khi xem hồ sơ) */
  static async maybeSendReminder(outline: ProjectOutline) {
    if (outline.status !== 'CHINH_SUA_TM') return false
    if (outline.revisionReminderSentAt) return false
    if (!this.needsReminder(outline.revisionDeadline)) return false

    const userIds = [
      ...new Set(
        [outline.ownerId, ...(await ProjectOutlineService.memberUserIds(outline.id))]
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ]
    if (!userIds.length) return false

    await NotificationService.pushMany(userIds, {
      type: 'PROJECT_UPDATE',
      title: 'Sắp hết hạn chỉnh sửa thuyết minh',
      message: `${outline.code}: hạn ${
        outline.revisionDeadline?.toFormat('dd/MM/yyyy') || ''
      } (còn ≤ ${REVISION_REMINDER_DAYS} ngày).`,
      link: `/projects/outlines/form/${outline.id}`,
    })
    outline.revisionReminderSentAt = DateTime.now()
    await outline.save()
    return true
  }
}
