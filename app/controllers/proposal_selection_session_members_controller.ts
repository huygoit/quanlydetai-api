import type { HttpContext } from '@adonisjs/core/http'
import ProposalSelectionSession from '#models/proposal_selection_session'
import ProposalSelectionSessionMember from '#models/proposal_selection_session_member'
import ScientificProfile from '#models/scientific_profile'
import PermissionService from '#services/permission_service'
import { addSessionMemberValidator } from '#validators/council_validator'

/** Trạng thái còn được thêm/xóa thành viên hội đồng */
const EDITABLE_STATUSES = new Set(['CREATED', 'OPEN', 'RETURNED'])

/**
 * Thành viên hội đồng phiên xét chọn đề tài.
 */
export default class ProposalSelectionSessionMembersController {
  private async assertPkh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  private async assertCanView(userId: number) {
    return (
      (await this.assertPkh(userId)) ||
      (await PermissionService.userHasPermission(userId, 'project.approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_approve')) ||
      (await PermissionService.userHasPermission(userId, 'council.view'))
    )
  }

  /** Đồng bộ JSON council_members (dùng biên bản) từ bảng thành viên */
  private async syncCouncilMembersJson(session: ProposalSelectionSession) {
    const list = await ProposalSelectionSessionMember.query()
      .where('session_id', session.id)
      .orderBy('id', 'asc')
    session.councilMembers = list.map((m) => ({
      name: m.memberName,
      role: m.roleInCouncil,
    }))
    await session.save()
  }

  private serialize(m: ProposalSelectionSessionMember) {
    return {
      id: m.id,
      memberId: m.memberId,
      memberName: m.memberName,
      memberEmail: m.memberEmail,
      roleInCouncil: m.roleInCouncil,
      unit: m.unit,
    }
  }

  /** GET /api/proposal-selection-sessions/:id/available-members */
  async availableMembers({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertCanView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })

    const existingIds = (
      await ProposalSelectionSessionMember.query().where('session_id', params.id).select('member_id')
    ).map((m) => m.memberId)
    const keyword = request.input('keyword', '')

    const q = ScientificProfile.query()
      .select(
        'id',
        'user_id',
        'full_name',
        'work_email',
        'degree',
        'academic_title',
        'organization',
        'faculty',
        'department',
        'current_title',
        'main_research_area',
        'phone'
      )
      .whereNotIn('user_id', existingIds.length > 0 ? existingIds : [0])
      .orderBy('full_name', 'asc')
      .limit(100)

    if (keyword && String(keyword).trim()) {
      const kw = `%${String(keyword).trim()}%`
      q.where((b) => {
        b.whereILike('full_name', kw)
          .orWhereILike('work_email', kw)
          .orWhereILike('organization', kw)
          .orWhereILike('faculty', kw)
          .orWhereILike('department', kw)
      })
    }

    const profiles = await q
    const data = profiles.map((p) => {
      const unit = [p.department, p.faculty, p.organization].filter(Boolean).join(' – ') || null
      return {
        userId: p.userId,
        fullName: p.fullName,
        workEmail: p.workEmail,
        degree: p.degree ?? null,
        academicTitle: p.academicTitle ?? null,
        organization: p.organization ?? null,
        faculty: p.faculty ?? null,
        department: p.department ?? null,
        unit,
        currentTitle: p.currentTitle ?? null,
        mainResearchArea: p.mainResearchArea ?? null,
        phone: p.phone ?? null,
      }
    })
    return response.ok({ success: true, data })
  }

  /** GET /api/proposal-selection-sessions/:id/members */
  async index({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertCanView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const list = await ProposalSelectionSessionMember.query()
      .where('session_id', params.id)
      .orderBy('id', 'asc')
    return response.ok({ success: true, data: list.map((m) => this.serialize(m)) })
  }

  /** POST /api/proposal-selection-sessions/:id/members */
  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH thêm thành viên hội đồng.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (!EDITABLE_STATUSES.has(String(session.status))) {
      return response.badRequest({
        success: false,
        message: 'Chỉ thêm thành viên khi phiên Đã tạo / Đang họp / BGH trả lại.',
      })
    }
    const payload = await request.validateUsing(addSessionMemberValidator)
    const exists = await ProposalSelectionSessionMember.query()
      .where('session_id', params.id)
      .where('member_id', payload.memberId)
      .first()
    if (exists) {
      return response.badRequest({ success: false, message: 'Thành viên đã có trong phiên.' })
    }
    await ProposalSelectionSessionMember.create({
      sessionId: session.id,
      memberId: payload.memberId,
      memberName: payload.memberName,
      memberEmail: payload.memberEmail ?? null,
      roleInCouncil: payload.roleInCouncil,
      unit: payload.unit ?? null,
    })
    await this.syncCouncilMembersJson(session)
    const list = await ProposalSelectionSessionMember.query()
      .where('session_id', params.id)
      .orderBy('id', 'asc')
    return response.ok({ success: true, data: list.map((m) => this.serialize(m)) })
  }

  /** DELETE /api/proposal-selection-sessions/:id/members/:memberId */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH xóa thành viên hội đồng.' })
    }
    const session = await ProposalSelectionSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (!EDITABLE_STATUSES.has(String(session.status))) {
      return response.badRequest({
        success: false,
        message: 'Chỉ xóa thành viên khi phiên Đã tạo / Đang họp / BGH trả lại.',
      })
    }
    const member = await ProposalSelectionSessionMember.query()
      .where('session_id', params.id)
      .where('member_id', params.memberId)
      .first()
    if (!member) {
      return response.notFound({ success: false, message: 'Không tìm thấy thành viên trong phiên.' })
    }
    await member.delete()
    await this.syncCouncilMembersJson(session)
    return response.ok({ success: true, message: 'Đã xóa thành viên.' })
  }
}
