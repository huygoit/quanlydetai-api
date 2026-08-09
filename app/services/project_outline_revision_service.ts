import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectOutlineBudgetLine from '#models/project_outline_budget_line'
import ProjectOutlineVersion from '#models/project_outline_version'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'

/** Số ngày nhắc trước deadline (tham khảo US-04-05) */
export const REVISION_REMINDER_DAYS = 2
/** Giải trình bắt buộc tối thiểu */
export const MIN_REVISION_EXPLANATION = 100

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

  static serializeVersion(v: ProjectOutlineVersion) {
    return {
      id: v.id,
      projectOutlineId: v.projectOutlineId,
      versionNo: v.versionNo,
      parentVersionId: v.parentVersionId,
      versionType: v.versionType,
      status: v.status,
      outlineFileUrl: v.outlineFileUrl,
      appendixFileUrl: v.appendixFileUrl,
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
    actorId: number | null
  ) {
    const existingBaseline = await ProjectOutlineVersion.query()
      .where('project_outline_id', outline.id)
      .where('version_type', 'BASELINE_AFTER_DEFENSE')
      .first()

    let baseline = existingBaseline
    if (!baseline) {
      const snapshot = await this.buildSnapshot(outline.id)
      baseline = await ProjectOutlineVersion.create({
        projectOutlineId: outline.id,
        versionNo: await this.nextVersionNo(outline.id),
        parentVersionId: null,
        versionType: 'BASELINE_AFTER_DEFENSE',
        status: 'LOCKED',
        snapshotJson: snapshot,
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

    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Yêu cầu chỉnh sửa thuyết minh',
        message: `${outline.code}: hãy chỉnh sửa và nộp bản hoàn thiện trước ${
          outline.revisionDeadline
            ? outline.revisionDeadline.toFormat('dd/MM/yyyy')
            : 'hạn PKH đã chọn'
        }.`,
        link: `/projects/outlines/form/${outline.id}`,
      })
    }

    return baseline
  }

  static async getRevisionContext(outline: ProjectOutline) {
    const session = outline.activeDefenseSessionId
      ? await ProjectOutlineDefenseSession.find(outline.activeDefenseSessionId)
      : await ProjectOutlineDefenseSession.query()
          .where('project_outline_id', outline.id)
          .where('status', 'FINALIZED')
          .where('conclusion', 'THONG_QUA_DIEU_CHINH')
          .orderBy('id', 'desc')
          .first()

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

    return {
      status: outline.status,
      revisionDeadline: outline.revisionDeadline?.toISO() ?? null,
      pastDeadline,
      needsReminder: remind && outline.status === 'CHINH_SUA_TM',
      reminderDays: REVISION_REMINDER_DAYS,
      revisionExplanation: outline.revisionExplanation,
      adjustmentRequirements: session?.adjustmentRequirements ?? null,
      discussionNotes: session?.discussionNotes ?? null,
      conclusion: session?.conclusion ?? outline.defenseConclusion,
      minutesFileUrl: session?.minutesFileUrl ?? null,
      finalScore: session?.finalScore == null ? null : Number(session.finalScore),
      baselineVersion: baseline ? this.serializeVersion(baseline) : null,
      submittedVersion: submitted ? this.serializeVersion(submitted) : null,
      diffLimitNote:
        'Hệ thống so sánh các trường form và metadata file (tên/URL). Chưa hỗ trợ diff nội dung DOCX/PDF.',
      minExplanationLength: MIN_REVISION_EXPLANATION,
      editable:
        outline.status === 'CHINH_SUA_TM' && !pastDeadline,
      canSubmit:
        outline.status === 'CHINH_SUA_TM' && !pastDeadline,
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
    // Idempotent
    if (outline.status === 'CHO_XAC_NHAN_KP' && outline.revisionSubmittedVersionId) {
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
      throw new Error('Cần upload file thuyết minh phiên bản mới trước khi nộp.')
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

    // Chống nộp trùng đồng thời: nếu đã có REVISION_SUBMITTED thì trả về
    const existingSubmitted = await ProjectOutlineVersion.query()
      .where('project_outline_id', outline.id)
      .where('version_type', 'REVISION_SUBMITTED')
      .first()
    if (existingSubmitted) {
      outline.status = 'CHO_XAC_NHAN_KP'
      outline.revisionSubmittedVersionId = existingSubmitted.id
      outline.revisionSubmittedAt = existingSubmitted.lockedAt || DateTime.now()
      outline.revisionExplanation = explanation.trim()
      await outline.save()
      return { outline, version: existingSubmitted, idempotent: true }
    }

    const snapshot = await this.buildSnapshot(outline.id)
    const version = await ProjectOutlineVersion.create({
      projectOutlineId: outline.id,
      versionNo: await this.nextVersionNo(outline.id),
      parentVersionId: baselineId,
      versionType: 'REVISION_SUBMITTED',
      status: 'LOCKED',
      snapshotJson: snapshot,
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
    outline.status = 'CHO_XAC_NHAN_KP'
    outline.completionPercent = 100
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      actorId,
      'SUBMIT_REVISION',
      from,
      'CHO_XAC_NHAN_KP',
      { versionId: version.id, parentVersionId: baselineId }
    )

    await NotificationService.pushToPermission('project.review', {
      type: 'PROJECT_UPDATE',
      title: 'Đã nộp bản thuyết minh hoàn thiện',
      message: `${outline.code} — chờ xác nhận kinh phí.`,
      link: `/projects/outlines/form/${outline.id}`,
    })

    if (outline.ownerEmail && outline.ownerId) {
      await EmailLogService.logStubToUser(
        outline.ownerId,
        `[KH&CN] Đã nộp bản hoàn thiện ${outline.code}`,
        `Thuyết minh ${outline.code} đã được nộp bản hoàn thiện và chuyển sang chờ xác nhận kinh phí.`,
        'project_outline',
        outline.id
      )
    }

    return { outline, version, idempotent: false }
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

    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
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
      (fromVersionId
        ? await ProjectOutlineVersion.find(fromVersionId)
        : null) ||
      (await ProjectOutlineVersion.query()
        .where('project_outline_id', outlineId)
        .where('version_type', 'BASELINE_AFTER_DEFENSE')
        .orderBy('id', 'desc')
        .first())

    let afterSnap: OutlineSnapshot
    let afterMeta: ReturnType<typeof this.serializeVersion> | null = null

    if (toVersionId) {
      const ver = await ProjectOutlineVersion.findOrFail(toVersionId)
      afterSnap = ver.snapshotJson as OutlineSnapshot
      afterMeta = this.serializeVersion(ver)
    } else {
      afterSnap = await this.buildSnapshot(outlineId)
    }

    if (!baseline) {
      return {
        diffs: [],
        baseline: null,
        after: afterMeta,
        diffLimitNote:
          'Chưa có bản đóng băng sau bảo vệ. Chỉ hiển thị bản hiện tại. Không diff DOCX/PDF.',
      }
    }

    const before = baseline.snapshotJson as OutlineSnapshot
    return {
      diffs: this.diffSnapshots(before, afterSnap),
      baseline: this.serializeVersion(baseline),
      after: afterMeta,
      diffLimitNote:
        'So sánh trường form + metadata file (URL). Chưa hỗ trợ diff nội dung DOCX/PDF.',
    }
  }

  /** Gửi nhắc nếu gần deadline (có thể gọi từ cron / khi xem hồ sơ) */
  static async maybeSendReminder(outline: ProjectOutline) {
    if (outline.status !== 'CHINH_SUA_TM') return false
    if (outline.revisionReminderSentAt) return false
    if (!this.needsReminder(outline.revisionDeadline)) return false
    if (!outline.ownerId) return false

    await NotificationService.push(outline.ownerId, {
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
