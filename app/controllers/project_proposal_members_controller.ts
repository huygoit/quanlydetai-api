import type { HttpContext } from '@adonisjs/core/http'
import ProjectProposal from '#models/project_proposal'
import ProjectProposalMember from '#models/project_proposal_member'
import {
  upsertProjectProposalMembersValidator,
  validateMembersListRules,
  validateManualMemberGender,
  prepareMembersRequestBody,
  resolvedMemberOrder,
  resolvedMemberRole,
  resolvedProfileIdFromRow,
  resolvedStudentIdFromRow,
  resolvedGenderForSave,
} from '#validators/project_proposal_member_validator'
import { mapProjectProposalMemberToApi } from '#utils/project_proposal_member_api'

const OTHER_UNIT_LABEL = 'Other Organization (Đơn vị khác)'
const LEGACY_OTHER_UNIT_LABEL = 'Đơn vị khác'

function deriveAffiliationTypeFromUnits(
  units: string[] | undefined
): 'UDN_ONLY' | 'MIXED' | 'OUTSIDE' | null {
  const picked = Array.isArray(units)
    ? Array.from(
        new Set(
          units
            .map((v) => String(v ?? '').trim())
            .filter((v) => v.length > 0)
        )
      )
    : []
  if (picked.length === 0) return null
  const hasOutside = picked.includes(OTHER_UNIT_LABEL) || picked.includes(LEGACY_OTHER_UNIT_LABEL)
  const hasUdn = picked.some((v) => v !== OTHER_UNIT_LABEL && v !== LEGACY_OTHER_UNIT_LABEL)
  if (hasOutside && hasUdn) return 'MIXED'
  if (hasOutside) return 'OUTSIDE'
  return 'UDN_ONLY'
}

/**
 * Sub-resource: thành viên đề xuất đề tài.
 * GET/PUT /api/project-proposals/:id/members
 */
export default class ProjectProposalMembersController {
  private isEditable(status: string) {
    return status === 'DRAFT' || status === 'RETURNED' || status === 'YEU_CAU_BS'
  }

  /** GET /api/project-proposals/:id/members */
  async index({ params, response }: HttpContext) {
    const proposalId = Number(params.id)
    if (!Number.isFinite(proposalId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const proposal = await ProjectProposal.find(proposalId)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }

    const members = await ProjectProposalMember.query()
      .where('project_proposal_id', proposalId)
      .preload('profile', (q) =>
        q.select('id', 'gender', 'full_name', 'degree', 'academic_title')
      )
      .preload('student', (q) => q.select('id', 'gender', 'full_name'))
      .orderBy('member_order', 'asc')

    return response.ok({
      success: true,
      data: members.map((m) => mapProjectProposalMemberToApi(m)),
    })
  }

  /**
   * PUT /api/project-proposals/:id/members
   * Body: { members: [...] } (cũng chấp nhận { authors: [...] } từ AuthorsEditor)
   * Chỉ owner, trạng thái DRAFT/RETURNED.
   * Đồng bộ co_authors (tên hiển thị) từ danh sách thành viên.
   */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const proposalId = Number(params.id)
    if (!Number.isFinite(proposalId)) {
      return response.badRequest({ success: false, message: 'id không hợp lệ.' })
    }

    const proposal = await ProjectProposal.find(proposalId)
    if (!proposal) {
      return response.notFound({ success: false, message: 'Không tìm thấy đề xuất.' })
    }
    if (!this.isEditable(proposal.status)) {
      return response.badRequest({
        success: false,
        message: 'Chỉ được sửa thành viên khi đề xuất ở trạng thái Nháp hoặc Khoa trả lại.',
      })
    }
    // owner_id bigint vs user.id number — so sánh Number để tránh 403 nhầm
    if (Number(proposal.ownerId) !== Number(user.id)) {
      return response.forbidden({ success: false, message: 'Bạn không có quyền sửa đề xuất này.' })
    }

    prepareMembersRequestBody(request)

    // Đảm bảo body có key members (FE có thể gửi authors từ AuthorsEditor)
    const rawList = Array.isArray(request.input('members'))
      ? request.input('members')
      : Array.isArray(request.input('authors'))
        ? request.input('authors')
        : []
    if (typeof (request as any).updateBody === 'function') {
      ;(request as any).updateBody({ members: rawList })
    } else if (typeof (request as any).update === 'function') {
      ;(request as any).update({ members: rawList })
    }

    const payload = await request.validateUsing(upsertProjectProposalMembersValidator)
    validateMembersListRules(payload.members)
    validateManualMemberGender(payload.members)

    const incomingIds = new Set(
      payload.members.map((m) => m.id).filter((id): id is number => id !== undefined && id !== null)
    )

    const existing = await ProjectProposalMember.query().where('project_proposal_id', proposalId)
    for (const row of existing.filter((e) => !incomingIds.has(e.id))) {
      await row.delete()
    }

    for (const a of payload.members) {
      const derivedAffType = deriveAffiliationTypeFromUnits(a.affiliation_units)
      const effectiveAffType = derivedAffType ?? a.affiliation_type
      const effectiveMulti = effectiveAffType === 'MIXED'
      const nextProfileId = resolvedProfileIdFromRow(a)
      const nextStudentId = resolvedStudentIdFromRow(a)
      const nextGender = resolvedGenderForSave(a)
      const order = resolvedMemberOrder(a)
      const role = resolvedMemberRole(a)

      if (a.id != null) {
        const member = await ProjectProposalMember.query()
          .where('id', a.id)
          .where('project_proposal_id', proposalId)
          .first()
        if (member) {
          member.fullName = a.full_name
          member.affiliationUnits = a.affiliation_units ?? []
          member.memberOrder = order
          member.role = role
          member.affiliationType = effectiveAffType
          member.isMultiAffiliationOutsideUdn = effectiveMulti
          member.contributionPercent = a.contribution_percent ?? null
          member.gender = nextGender
          if (nextProfileId !== undefined) member.profileId = nextProfileId
          if (nextStudentId !== undefined) member.studentId = nextStudentId
          await member.save()
          continue
        }
      }

      await ProjectProposalMember.create({
        projectProposalId: proposalId,
        profileId: nextProfileId ?? null,
        studentId: nextStudentId ?? null,
        gender: nextGender,
        fullName: a.full_name,
        affiliationUnits: a.affiliation_units ?? [],
        memberOrder: order,
        role,
        affiliationType: effectiveAffType,
        isMultiAffiliationOutsideUdn: effectiveMulti,
        contributionPercent: a.contribution_percent ?? null,
      })
    }

    // Đồng bộ cột hiển thị cũ co_authors
    const saved = await ProjectProposalMember.query()
      .where('project_proposal_id', proposalId)
      .preload('profile', (q) =>
        q.select('id', 'gender', 'full_name', 'degree', 'academic_title')
      )
      .preload('student', (q) => q.select('id', 'gender', 'full_name'))
      .orderBy('member_order', 'asc')

    proposal.coAuthors = saved.map((m) => mapProjectProposalMemberToApi(m).fullName)
    await proposal.save()

    return response.ok({
      success: true,
      data: saved.map((m) => mapProjectProposalMemberToApi(m)),
    })
  }
}
