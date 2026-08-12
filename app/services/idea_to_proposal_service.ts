import Idea from '#models/idea'
import ProjectProposal from '#models/project_proposal'
import ProjectProcessType from '#models/project_process_type'
import ProjectProposalAudit from '#models/project_proposal_audit'
import User from '#models/user'
import CallForProposalService from '#services/call_for_proposal_service'
import { levelFromProcessTypeCode } from '#utils/project_process_type_level'

/** Ánh xạ mã IDEA_LEVEL cũ → mã QT danh mục Cấp ý tưởng/đề tài */
const LEGACY_IDEA_LEVEL_TO_QT: Record<string, string> = {
  TRUONG_THUONG_NIEN: 'QT-I',
  TRUONG_DAT_HANG: 'QT-I',
  DAI_HOC_DA_NANG: 'QT-II',
  BO_GDDT: 'QT-II',
  NHA_NUOC: 'QT-IV',
  NAFOSTED: 'QT-IV',
  TINH_THANH_PHO: 'QT-III',
  DOANH_NGHIEP: 'QT-III',
}

export type IdeaToProposalResult = {
  proposal: ProjectProposal
  created: boolean
}

/**
 * Tạo đề xuất đề tài (DRAFT) từ ý tưởng đã phê duyệt đặt hàng.
 * Idempotent theo source_idea_id.
 */
export default class IdeaToProposalService {
  /** Chọn loại QT từ suitableLevels (ưu tiên mã QT-*), fallback QT-I */
  private static async resolveProcessType(suitableLevels: string[]): Promise<ProjectProcessType> {
    const levels = Array.isArray(suitableLevels) ? suitableLevels : []
    const preferredCodes: string[] = []

    for (const raw of levels) {
      const code = String(raw || '').trim()
      if (!code) continue
      if (code.startsWith('QT-')) {
        preferredCodes.push(code)
      } else if (LEGACY_IDEA_LEVEL_TO_QT[code]) {
        preferredCodes.push(LEGACY_IDEA_LEVEL_TO_QT[code])
      }
    }

    for (const code of preferredCodes) {
      const row = await ProjectProcessType.query()
        .where('code', code)
        .where('status', 'ACTIVE')
        .first()
      if (row) return row
    }

    const fallback = await ProjectProcessType.query()
      .where('code', 'QT-I')
      .where('status', 'ACTIVE')
      .first()
    if (fallback) return fallback

    const any = await ProjectProcessType.query().where('status', 'ACTIVE').orderBy('display_order', 'asc').first()
    if (!any) {
      throw new Error('NO_ACTIVE_PROCESS_TYPE')
    }
    return any
  }

  /**
   * Tạo (hoặc lấy lại) đề xuất DRAFT từ ý tưởng.
   * @param actorUserId user thực hiện (lãnh đạo phê duyệt / PKH khởi tạo) — ghi audit
   */
  static async createDraftFromIdea(idea: Idea, actorUserId: number): Promise<IdeaToProposalResult> {
    const existing = await ProjectProposal.query().where('source_idea_id', idea.id).first()
    if (existing) {
      if (!idea.linkedProjectId) {
        idea.linkedProjectId = existing.code
        await idea.save()
      }
      return { proposal: existing, created: false }
    }

    const processType = await this.resolveProcessType(idea.suitableLevels ?? [])
    const level = levelFromProcessTypeCode(processType.code)
    const year = new Date().getFullYear()
    const owner = await User.find(idea.ownerId)

    let callForProposalId: number | null = null
    try {
      const active = await CallForProposalService.findActivePeriodForLevel(level, processType.id)
      if (active?.callForProposal?.id) {
        callForProposalId = active.callForProposal.id
      }
    } catch {
      // Không chặn tạo nháp khi chưa có kỳ CFP mở
    }

    const tomTat = String(idea.summary || '').trim() || String(idea.title || '').trim()
    const code = await ProjectProposal.generateCode(year)

    const proposal = await ProjectProposal.create({
      code,
      title: idea.title,
      field: idea.field,
      level,
      year,
      durationMonths: 12,
      keywords: [],
      ownerId: idea.ownerId,
      ownerName: idea.ownerName,
      ownerEmail: owner?.email ?? null,
      ownerUnit: idea.ownerUnit || '',
      coAuthors: [],
      objectives: tomTat,
      summary: tomTat,
      contentOutline: `Tạo tự động từ ý tưởng ${idea.code}`,
      expectedResults: null,
      applicationPotential: null,
      requestedBudgetTotal: null,
      requestedBudgetDetail: null,
      researchOutputTypeId: null,
      researchDirection: null,
      attachmentUrl: null,
      callForProposalId,
      projectProcessTypeId: processType.id,
      sourceIdeaId: idea.id,
      status: 'DRAFT',
    })

    idea.linkedProjectId = proposal.code
    await idea.save()

    await ProjectProposalAudit.create({
      projectProposalId: proposal.id,
      actorUserId,
      action: 'CREATE_FROM_IDEA',
      fromStatus: null,
      toStatus: 'DRAFT',
      note: `Tạo từ ý tưởng ${idea.code} (id=${idea.id})`,
    })

    return { proposal, created: true }
  }
}
