import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ProjectOutline from '#models/project_outline'
import type {
  OutlineMilestone,
  OutlinePartnerUnit,
  OutlineProduct,
  ProjectOutlineStatus,
} from '#models/project_outline'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectOutlineBudgetLine from '#models/project_outline_budget_line'
import type { OutlineBudgetGroup } from '#models/project_outline_budget_line'
import ProjectOutlineAudit from '#models/project_outline_audit'
import ProjectProposal from '#models/project_proposal'
import ProjectProposalMember from '#models/project_proposal_member'
import ScientificProfile from '#models/scientific_profile'
import { resolveProposalMemberRole } from '#constants/proposal_member_role'
import { mapProjectOutlineMemberToApi } from '#utils/project_outline_member_api'

const BUDGET_TOLERANCE = 1000

type BudgetLineInput = {
  groupCode: OutlineBudgetGroup
  content: string
  amount: number
  note?: string | null
  lineOrder?: number
}

export default class ProjectOutlineService {
  static async generateCode(): Promise<string> {
    const year = DateTime.now().year
    const prefix = `TM-${year}-`
    const last = await ProjectOutline.query()
      .where('code', 'like', `${prefix}%`)
      .orderBy('id', 'desc')
      .first()
    let seq = 1
    if (last?.code) {
      const n = Number(last.code.replace(prefix, ''))
      if (Number.isFinite(n)) seq = n + 1
    }
    return `${prefix}${String(seq).padStart(4, '0')}`
  }

  /** Kiểm tra đề xuất đủ điều kiện soạn thuyết minh */
  static assertEligibleProposal(p: ProjectProposal) {
    if (p.status !== 'DUOC_CHON' || !p.canWriteOutline) {
      return 'Đề xuất chưa đủ điều kiện soạn thuyết minh.'
    }
    return null
  }

  /** Nội dung HTML editor có chữ thật (bỏ thẻ rỗng) */
  static hasHtmlContent(html?: string | null) {
    if (!html) return false
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.length > 0
  }

  /** Plain text từ đề xuất → HTML cho editor */
  static textToHtml(raw?: string | null): string | null {
    if (!raw?.trim()) return null
    const t = raw.trim()
    if (/<[a-z][\s\S]*>/i.test(t)) return t
    const escaped = t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<p>${escaped.replace(/\n/g, '<br>')}</p>`
  }

  /** Suy ngày bắt đầu / kết thúc từ năm + thời gian thực hiện đề xuất */
  static datesFromProposal(proposal: ProjectProposal): {
    startDate: DateTime | null
    endDate: DateTime | null
  } {
    const months = Number(proposal.durationMonths || 0)
    if (!proposal.year || months <= 0) return { startDate: null, endDate: null }
    const startDate = DateTime.fromObject({ year: proposal.year, month: 1, day: 1 }).startOf('day')
    const endDate = startDate.plus({ months }).minus({ days: 1 })
    return { startDate, endDate }
  }

  /** Map field từ đề xuất → bản thuyết minh (copy lần đầu) */
  static mapProposalFields(proposal: ProjectProposal) {
    const { startDate, endDate } = this.datesFromProposal(proposal)
    return {
      title: proposal.title,
      projectProcessTypeId: proposal.projectProcessTypeId,
      level: proposal.level,
      field: proposal.field,
      startDate,
      endDate,
      requestedBudget: Number(proposal.requestedBudgetTotal || 0),
      hostUnit: proposal.ownerUnit || null,
      applicationScope: this.textToHtml(proposal.applicationPotential),
      // Chưa có field riêng trên đề xuất → lấy tóm tắt làm gợi ý
      urgency: this.textToHtml(proposal.summary),
      detailedObjectives: this.textToHtml(proposal.objectives),
      researchContent: this.textToHtml(proposal.contentOutline),
      methodology: null as string | null,
      milestones: [] as { content: string; startDate?: string | null; endDate?: string | null; expectedResult?: string | null }[],
      expectedProducts: proposal.expectedResults
        ? [{ name: proposal.expectedResults.trim(), quantity: null, quality: null }]
        : [],
      summary: proposal.summary || null,
      councilFeedback: proposal.councilAdjustmentNote || null,
      ownerId: proposal.ownerId,
      ownerName: proposal.ownerName,
      ownerEmail: proposal.ownerEmail,
      ownerUnit: proposal.ownerUnit,
    }
  }

  /**
   * Bản nháp trống / thiếu: đổ lại từ đề xuất (không ghi đè field đã có nội dung).
   */
  static async syncEmptyFieldsFromProposal(outline: ProjectOutline, proposal: ProjectProposal) {
    if (outline.status !== 'THUYETMINH_DRAFT') return false
    const mapped = this.mapProposalFields(proposal)
    let changed = false

    const setIfEmpty = (key: keyof typeof mapped, currentEmpty: boolean) => {
      if (!currentEmpty) return
      const v = mapped[key]
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return
      ;(outline as any)[key] = v
      changed = true
    }

    setIfEmpty('title', !outline.title?.trim())
    setIfEmpty('projectProcessTypeId', !outline.projectProcessTypeId)
    setIfEmpty('level', !outline.level)
    setIfEmpty('field', !outline.field)
    setIfEmpty('startDate', !outline.startDate)
    setIfEmpty('endDate', !outline.endDate)
    setIfEmpty('requestedBudget', !Number(outline.requestedBudget))
    setIfEmpty('hostUnit', !outline.hostUnit?.trim())
    setIfEmpty('applicationScope', !this.hasHtmlContent(outline.applicationScope))
    setIfEmpty('urgency', !this.hasHtmlContent(outline.urgency))
    setIfEmpty('detailedObjectives', !this.hasHtmlContent(outline.detailedObjectives))
    setIfEmpty('researchContent', !this.hasHtmlContent(outline.researchContent))
    setIfEmpty('summary', !outline.summary?.trim())
    setIfEmpty('councilFeedback', !outline.councilFeedback?.trim())
    if (!(outline.expectedProducts || []).some((p) => p.name?.trim()) && mapped.expectedProducts.length) {
      outline.expectedProducts = mapped.expectedProducts
      changed = true
    }

    if (changed) {
      const members = await this.loadMembers(outline.id)
      const budgetLines = await this.loadBudgetLines(outline.id)
      outline.completionPercent = this.calcCompletion(outline, members, budgetLines)
      await outline.save()
    }
    return changed
  }

  /**
   * US-04-01: chỉ người đề xuất (owner) hoặc Chủ nhiệm (PRINCIPAL gắn hồ sơ) được soạn.
   * Thành viên khác (Thư ký / Thành viên) không được.
   */
  static async userCanWriteOutline(proposal: ProjectProposal, userId: number): Promise<boolean> {
    if (Number(proposal.ownerId) === Number(userId)) return true

    const profile = await ScientificProfile.query().where('user_id', userId).first()
    if (!profile) return false

    const principal = await ProjectProposalMember.query()
      .where('project_proposal_id', proposal.id)
      .where('role', 'PRINCIPAL')
      .where('profile_id', profile.id)
      .first()
    return !!principal
  }

  /** Id đề xuất mà user là owner hoặc CNĐT */
  static async proposalIdsWritableByUser(userId: number): Promise<number[]> {
    const owned = await ProjectProposal.query()
      .where('owner_id', userId)
      .where('status', 'DUOC_CHON')
      .where('can_write_outline', true)
      .select('id')

    const profile = await ScientificProfile.query().where('user_id', userId).first()
    let asPrincipal: ProjectProposal[] = []
    if (profile) {
      const memberRows = await ProjectProposalMember.query()
        .where('profile_id', profile.id)
        .where('role', 'PRINCIPAL')
        .select('project_proposal_id')
      const ids = memberRows.map((m) => m.projectProposalId)
      if (ids.length) {
        asPrincipal = await ProjectProposal.query()
          .whereIn('id', ids)
          .where('status', 'DUOC_CHON')
          .where('can_write_outline', true)
          .select('id')
      }
    }

    return [...new Set([...owned, ...asPrincipal].map((p) => p.id))]
  }

  /** Copy thông tin đề xuất → bản thuyết minh mới */
  static async createFromProposal(proposal: ProjectProposal, actorId: number) {
    await proposal.load('members')
    const code = await this.generateCode()
    const mapped = this.mapProposalFields(proposal)

    const outline = await ProjectOutline.create({
      projectProposalId: proposal.id,
      code,
      status: 'THUYETMINH_DRAFT',
      ...mapped,
      partnerUnits: [],
      outlineFileUrl: null,
      appendixFileUrl: null,
      completionPercent: 0,
    })

    // Kinh phí chi tiết sơ bộ từ ghi chú đề xuất (nếu có)
    if (proposal.requestedBudgetDetail?.trim()) {
      await ProjectOutlineBudgetLine.create({
        projectOutlineId: outline.id,
        groupCode: 'KHAC',
        content: proposal.requestedBudgetDetail.trim().slice(0, 500),
        amount: Number(proposal.requestedBudgetTotal || 0),
        note: 'Sao chép từ kinh phí đề xuất',
        lineOrder: 1,
      })
    }

    const sourceMembers: Array<{
      profileId?: number | null
      studentId?: number | null
      departmentId?: number | null
      fullName?: string
      memberOrder?: number
      role?: string
      affiliationType?: string | null
      affiliationUnits?: string[]
    }> = proposal.members?.length
      ? proposal.members
      : [
          {
            profileId: null,
            studentId: null,
            departmentId: null,
            fullName: proposal.ownerName,
            memberOrder: 1,
            role: 'PRINCIPAL',
            affiliationType: null,
            affiliationUnits: [],
          },
        ]

    for (const [i, m] of sourceMembers.entries()) {
      await ProjectOutlineMember.create({
        projectOutlineId: outline.id,
        profileId: m.profileId ?? null,
        studentId: m.studentId ?? null,
        departmentId: m.departmentId ?? null,
        fullName: m.fullName || proposal.ownerName,
        memberOrder: m.memberOrder ?? i + 1,
        role: resolveProposalMemberRole(m.role),
        affiliationType: m.affiliationType ?? null,
        affiliationUnits: m.affiliationUnits ?? [],
        gender: (m as any).gender ?? null,
        isMultiAffiliationOutsideUdn: !!(m as any).isMultiAffiliationOutsideUdn,
        contributionPercent:
          (m as any).contributionPercent != null
            ? Number((m as any).contributionPercent)
            : null,
        participationHours: null,
      })
    }

    await this.writeAudit(outline.id, actorId, 'CREATE_FROM_PROPOSAL', null, 'THUYETMINH_DRAFT', {
      projectProposalId: proposal.id,
      proposalCode: proposal.code,
    })

    outline.completionPercent = this.calcCompletion(
      outline,
      await this.loadMembers(outline.id),
      await this.loadBudgetLines(outline.id)
    )
    await outline.save()
    return outline
  }

  static async loadMembers(outlineId: number) {
    return ProjectOutlineMember.query()
      .where('project_outline_id', outlineId)
      .preload('profile', (q) =>
        q.select('id', 'gender', 'full_name', 'degree', 'academic_title')
      )
      .preload('student', (q) => q.select('id', 'gender', 'full_name'))
      .orderBy('member_order', 'asc')
  }

  static async loadBudgetLines(outlineId: number) {
    return ProjectOutlineBudgetLine.query()
      .where('project_outline_id', outlineId)
      .orderBy('line_order', 'asc')
  }

  static async writeAudit(
    outlineId: number,
    actorId: number | null,
    action: string,
    fromStatus: string | null,
    toStatus: string | null,
    note?: unknown
  ) {
    await ProjectOutlineAudit.create({
      projectOutlineId: outlineId,
      actorId,
      action,
      fromStatus,
      toStatus,
      note: note == null ? null : typeof note === 'string' ? note : JSON.stringify(note),
    })
  }

  static parseDate(v?: string | null): DateTime | null {
    if (!v) return null
    const d = DateTime.fromISO(v)
    return d.isValid ? d : null
  }

  static calcCompletion(
    o: ProjectOutline,
    members: ProjectOutlineMember[],
    budgetLines: ProjectOutlineBudgetLine[]
  ): number {
    const checks = [
      !!o.title?.trim(),
      !!o.projectProcessTypeId || !!o.level,
      !!o.startDate,
      !!o.endDate,
      Number(o.requestedBudget) >= 0 && o.requestedBudget !== null,
      !!o.hostUnit?.trim(),
      this.hasHtmlContent(o.applicationScope),
      this.hasHtmlContent(o.urgency),
      this.hasHtmlContent(o.detailedObjectives),
      this.hasHtmlContent(o.researchContent),
      this.hasHtmlContent(o.methodology),
      (o.milestones || []).some((m) => this.hasHtmlContent(m.content) || !!m.content?.trim()),
      (o.expectedProducts || []).some((p) => !!p.name?.trim()),
      members.some((m) => m.role === 'PRINCIPAL'),
      members.length > 0 && members.every((m) => !!m.fullName?.trim()),
      budgetLines.length > 0,
      !!o.outlineFileUrl?.trim(),
    ]
    const done = checks.filter(Boolean).length
    return Math.round((done / checks.length) * 100)
  }

  static validateForSubmit(
    o: ProjectOutline,
    members: ProjectOutlineMember[],
    budgetLines: ProjectOutlineBudgetLine[]
  ): string[] {
    const errors: string[] = []
    if (!o.title?.trim()) errors.push('Thiếu tên đề tài.')
    if (!o.projectProcessTypeId && !o.level) errors.push('Thiếu loại / cấp đề tài.')
    if (!o.startDate) errors.push('Thiếu ngày bắt đầu.')
    if (!o.endDate) errors.push('Thiếu ngày kết thúc.')
    if (o.startDate && o.endDate && o.startDate >= o.endDate) {
      errors.push('Ngày bắt đầu phải nhỏ hơn ngày kết thúc.')
    }
    if (o.requestedBudget == null || Number(o.requestedBudget) < 0) {
      errors.push('Kinh phí đề nghị không hợp lệ.')
    }
    if (!o.hostUnit?.trim()) errors.push('Thiếu đơn vị chủ trì.')
    if (!this.hasHtmlContent(o.applicationScope)) errors.push('Thiếu phạm vi ứng dụng.')
    if (!this.hasHtmlContent(o.urgency)) errors.push('Thiếu tính cấp thiết.')
    if (!this.hasHtmlContent(o.detailedObjectives)) errors.push('Thiếu mục tiêu chi tiết.')
    if (!this.hasHtmlContent(o.researchContent)) errors.push('Thiếu nội dung nghiên cứu.')
    if (!this.hasHtmlContent(o.methodology)) errors.push('Thiếu phương pháp nghiên cứu.')
    if (!(o.milestones || []).some((m) => this.hasHtmlContent(m.content) || !!m.content?.trim())) {
      errors.push('Cần ít nhất một mốc tiến độ.')
    }
    if (!(o.expectedProducts || []).some((p) => !!p.name?.trim())) {
      errors.push('Cần ít nhất một sản phẩm dự kiến.')
    }
    if (!members.some((m) => m.role === 'PRINCIPAL')) {
      errors.push('Thiếu chủ nhiệm đề tài.')
    }
    for (const m of members) {
      if (!m.fullName?.trim()) errors.push('Thành viên thiếu họ tên.')
    }
    if (!budgetLines.length) errors.push('Thiếu kinh phí chi tiết.')
    const totalDetail = budgetLines.reduce((s, l) => s + Number(l.amount || 0), 0)
    const diff = Math.abs(totalDetail - Number(o.requestedBudget || 0))
    if (diff > BUDGET_TOLERANCE) {
      errors.push(
        `Chênh lệch kinh phí chi tiết và kinh phí đề nghị là ${diff.toLocaleString('vi-VN')}đ (cho phép ≤ 1.000đ).`
      )
    }
    if (!o.outlineFileUrl?.trim()) errors.push('Thiếu file thuyết minh (PDF/DOCX).')
    return [...new Set(errors)]
  }

  static async replaceMembers(
    outlineId: number,
    members: Array<{
      profileId?: number | null
      studentId?: number | null
      departmentId?: number | null
      fullName: string
      memberOrder?: number
      authorOrder?: number
      role?: string
      proposalMemberRole?: string
      affiliationType?: string | null
      affiliationUnits?: string[]
      contributionPercent?: number | null
      participationHours?: number | null
      gender?: string | null
      isMultiAffiliationOutsideUdn?: boolean
      // snake_case từ FE AuthorsEditor
      profile_id?: number | null
      student_id?: number | null
      full_name?: string
      member_order?: number
      author_order?: number
      affiliation_type?: string | null
      affiliation_units?: string[]
      contribution_percent?: number | null
      is_multi_affiliation_outside_udn?: boolean
    }>
  ) {
    await ProjectOutlineMember.query().where('project_outline_id', outlineId).delete()
    for (const [i, raw] of members.entries()) {
      const fullName = String(raw.fullName || raw.full_name || '').trim()
      if (!fullName) continue
      const order = Number(raw.memberOrder ?? raw.authorOrder ?? raw.member_order ?? raw.author_order ?? i + 1)
      const role = resolveProposalMemberRole(raw.proposalMemberRole || raw.role)
      const units = raw.affiliationUnits ?? raw.affiliation_units ?? []
      await ProjectOutlineMember.create({
        projectOutlineId: outlineId,
        profileId: raw.profileId ?? raw.profile_id ?? null,
        studentId: raw.studentId ?? raw.student_id ?? null,
        departmentId: raw.departmentId ?? null,
        fullName,
        memberOrder: Number.isFinite(order) && order > 0 ? order : i + 1,
        role,
        affiliationType: raw.affiliationType ?? raw.affiliation_type ?? null,
        affiliationUnits: Array.isArray(units) ? units : [],
        gender: raw.gender ?? null,
        isMultiAffiliationOutsideUdn: !!(
          raw.isMultiAffiliationOutsideUdn ?? raw.is_multi_affiliation_outside_udn
        ),
        contributionPercent:
          raw.contributionPercent != null
            ? Number(raw.contributionPercent)
            : raw.contribution_percent != null
              ? Number(raw.contribution_percent)
              : null,
        participationHours:
          raw.participationHours == null ? null : Number(raw.participationHours),
      })
    }
  }

  static async replaceBudgetLines(outlineId: number, lines: BudgetLineInput[]) {
    await ProjectOutlineBudgetLine.query().where('project_outline_id', outlineId).delete()
    for (const [i, l] of lines.entries()) {
      await ProjectOutlineBudgetLine.create({
        projectOutlineId: outlineId,
        groupCode: l.groupCode,
        content: l.content.trim(),
        amount: Math.round(Number(l.amount || 0)),
        note: l.note?.trim() || null,
        lineOrder: l.lineOrder ?? i + 1,
      })
    }
  }

  static applyDraftFields(
    outline: ProjectOutline,
    payload: {
      title?: string
      projectProcessTypeId?: number | null
      level?: string | null
      field?: string | null
      startDate?: string | null
      endDate?: string | null
      requestedBudget?: number
      hostUnit?: string | null
      partnerUnits?: OutlinePartnerUnit[]
      applicationScope?: string | null
      urgency?: string | null
      detailedObjectives?: string | null
      researchContent?: string | null
      methodology?: string | null
      milestones?: OutlineMilestone[]
      expectedProducts?: OutlineProduct[]
      summary?: string | null
      outlineFileUrl?: string | null
      appendixFileUrl?: string | null
    }
  ) {
    if (payload.title !== undefined) outline.title = payload.title
    if (payload.projectProcessTypeId !== undefined) {
      outline.projectProcessTypeId = payload.projectProcessTypeId
    }
    if (payload.level !== undefined) outline.level = payload.level
    if (payload.field !== undefined) outline.field = payload.field
    if (payload.startDate !== undefined) outline.startDate = this.parseDate(payload.startDate)
    if (payload.endDate !== undefined) outline.endDate = this.parseDate(payload.endDate)
    if (payload.requestedBudget !== undefined) {
      outline.requestedBudget = Math.round(Number(payload.requestedBudget || 0))
    }
    if (payload.hostUnit !== undefined) outline.hostUnit = payload.hostUnit
    if (payload.partnerUnits !== undefined) outline.partnerUnits = payload.partnerUnits
    if (payload.applicationScope !== undefined) outline.applicationScope = payload.applicationScope
    if (payload.urgency !== undefined) outline.urgency = payload.urgency
    if (payload.detailedObjectives !== undefined) {
      outline.detailedObjectives = payload.detailedObjectives
    }
    if (payload.researchContent !== undefined) outline.researchContent = payload.researchContent
    if (payload.methodology !== undefined) outline.methodology = payload.methodology
    if (payload.milestones !== undefined) outline.milestones = payload.milestones
    if (payload.expectedProducts !== undefined) outline.expectedProducts = payload.expectedProducts
    if (payload.summary !== undefined) outline.summary = payload.summary
    if (payload.outlineFileUrl !== undefined) outline.outlineFileUrl = payload.outlineFileUrl
    if (payload.appendixFileUrl !== undefined) outline.appendixFileUrl = payload.appendixFileUrl
  }

  static serialize(
    o: ProjectOutline,
    members?: ProjectOutlineMember[],
    budgetLines?: ProjectOutlineBudgetLine[]
  ) {
    const ms = members ?? o.members ?? []
    const bl = budgetLines ?? o.budgetLines ?? []
    const totalDetail = bl.reduce((s, l) => s + Number(l.amount || 0), 0)
    return {
      id: o.id,
      projectProposalId: o.projectProposalId,
      code: o.code,
      status: o.status as ProjectOutlineStatus,
      title: o.title,
      projectProcessTypeId: o.projectProcessTypeId,
      level: o.level,
      field: o.field,
      startDate: o.startDate?.toISO() ?? null,
      endDate: o.endDate?.toISO() ?? null,
      requestedBudget: Number(o.requestedBudget || 0),
      hostUnit: o.hostUnit,
      partnerUnits: o.partnerUnits || [],
      applicationScope: o.applicationScope,
      urgency: o.urgency,
      detailedObjectives: o.detailedObjectives,
      researchContent: o.researchContent,
      methodology: o.methodology,
      milestones: o.milestones || [],
      expectedProducts: o.expectedProducts || [],
      summary: o.summary,
      councilFeedback: o.councilFeedback,
      outlineFileUrl: o.outlineFileUrl,
      appendixFileUrl: o.appendixFileUrl,
      completionPercent: o.completionPercent,
      ownerId: o.ownerId,
      ownerName: o.ownerName,
      ownerEmail: o.ownerEmail,
      ownerUnit: o.ownerUnit,
      submittedBy: o.submittedBy,
      submittedAt: o.submittedAt?.toISO() ?? null,
      withdrawnAt: o.withdrawnAt?.toISO() ?? null,
      reviewAssignedAt: o.reviewAssignedAt?.toISO() ?? null,
      reviewAssignedBy: o.reviewAssignedBy,
      reviewerCountTarget: o.reviewerCountTarget,
      reviewAverageScore:
        o.reviewAverageScore == null ? null : Number(o.reviewAverageScore),
      reviewBelowThreshold: o.reviewBelowThreshold,
      reviewScoresCompletedAt: o.reviewScoresCompletedAt?.toISO() ?? null,
      activeDefenseSessionId: o.activeDefenseSessionId,
      defenseScheduledAt: o.defenseScheduledAt?.toISO() ?? null,
      defenseConclusion: o.defenseConclusion,
      defenseFinalizedAt: o.defenseFinalizedAt?.toISO() ?? null,
      revisionDeadline: o.revisionDeadline?.toISO() ?? null,
      revisionExplanation: o.revisionExplanation,
      revisionBaselineVersionId: o.revisionBaselineVersionId,
      revisionSubmittedVersionId: o.revisionSubmittedVersionId,
      revisionSubmittedAt: o.revisionSubmittedAt?.toISO() ?? null,
      confirmedBudget: o.confirmedBudget == null ? null : Number(o.confirmedBudget),
      approvedBudget: o.approvedBudget == null ? null : Number(o.approvedBudget),
      module5Opened: !!o.module5Opened,
      module5OpenedAt: o.module5OpenedAt?.toISO() ?? null,
      activeBudgetConfirmationId: o.activeBudgetConfirmationId,
      createdAt: o.createdAt?.toISO() ?? null,
      updatedAt: o.updatedAt?.toISO() ?? null,
      projectProposal: o.projectProposal
        ? {
            id: o.projectProposal.id,
            code: o.projectProposal.code,
            status: o.projectProposal.status,
            canWriteOutline: o.projectProposal.canWriteOutline,
          }
        : undefined,
      members: ms.map((m) => mapProjectOutlineMemberToApi(m)),
      budgetLines: bl.map((l) => ({
        id: l.id,
        groupCode: l.groupCode,
        content: l.content,
        amount: Number(l.amount || 0),
        note: l.note,
        lineOrder: l.lineOrder,
      })),
      totalDetailBudget: totalDetail,
      budgetDifference: Math.abs(totalDetail - Number(o.requestedBudget || 0)),
      editable: o.status === 'THUYETMINH_DRAFT' || o.status === 'CHINH_SUA_TM',
    }
  }

  static async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return db.transaction(async () => fn())
  }
}
