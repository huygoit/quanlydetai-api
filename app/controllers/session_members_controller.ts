import type { HttpContext } from '@adonisjs/core/http'
import CouncilSession from '#models/council_session'
import SessionMember from '#models/session_member'
import ScientificProfile from '#models/scientific_profile'
import Role from '#models/role'
import CouncilPermissionService from '#services/council_permission_service'
import PermissionService from '#services/permission_service'
import UserRoleAssignmentService from '#services/user_role_assignment_service'
import { addSessionMemberValidator } from '#validators/council_validator'

/**
 * Thành viên phiên hội đồng: GET list, POST add, DELETE remove.
 */
export default class SessionMembersController {
  /**
   * GET /api/council-sessions/:id/available-members
   * Danh sách hồ sơ khoa học chưa có trong phiên - để chọn thêm thành viên.
   */
  async availableMembers({ params, request, response }: HttpContext) {
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const existingIds = (await SessionMember.query().where('session_id', params.id).select('member_id')).map((m) => m.memberId)
    const keyword = request.input('keyword', '')

    const q = ScientificProfile.query()
      .select('id', 'user_id', 'full_name', 'work_email', 'degree', 'academic_title', 'organization', 'faculty', 'department', 'current_title', 'main_research_area', 'phone')
      .whereNotIn('user_id', existingIds.length > 0 ? existingIds : [0])
      .orderBy('full_name', 'asc')
      .limit(100)

    if (keyword && keyword.trim()) {
      q.where((b) => {
        b.whereILike('full_name', `%${keyword}%`)
          .orWhereILike('work_email', `%${keyword}%`)
          .orWhereILike('organization', `%${keyword}%`)
          .orWhereILike('faculty', `%${keyword}%`)
          .orWhereILike('department', `%${keyword}%`)
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

  async index({ params, response }: HttpContext) {
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    const list = await SessionMember.query().where('session_id', params.id).orderBy('id', 'asc')
    const data = list.map((m) => ({
      id: m.id,
      memberId: m.memberId,
      memberName: m.memberName,
      memberEmail: m.memberEmail,
      roleInCouncil: m.roleInCouncil,
      unit: m.unit,
    }))
    return response.ok({ success: true, data })
  }

  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được thêm thành viên.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ thêm được khi phiên DRAFT.' })
    const payload = await request.validateUsing(addSessionMemberValidator)
    const exists = await SessionMember.query().where('session_id', params.id).where('member_id', payload.memberId).first()
    if (exists) return response.badRequest({ success: false, message: 'Thành viên đã có trong phiên.' })
    await SessionMember.create({
      sessionId: session.id,
      memberId: payload.memberId,
      memberName: payload.memberName,
      memberEmail: payload.memberEmail ?? null,
      roleInCouncil: payload.roleInCouncil,
      unit: payload.unit ?? null,
    })
    session.memberCount = session.memberCount + 1
    await session.save()

    // Tự động cấp quyền council.score cho thành viên hội đồng nếu chưa có (thông qua role IAM chuyên dụng).
    // Lưu ý: hệ thống IAM hiện tại chỉ tính quyền qua role → ở đây gán role có code 'COUNCIL_MEMBER' nếu tồn tại.
    try {
      const targetUserId = payload.memberId
      const hasScore = await PermissionService.userHasPermission(targetUserId, 'council.score')
      if (!hasScore) {
        const councilRole = await Role.query().where('code', 'COUNCIL_MEMBER').first()
        if (councilRole) {
          await UserRoleAssignmentService.assignRole(targetUserId, { roleId: councilRole.id })
        }
      }
    } catch (e) {
      // Không chặn luồng chính nếu việc auto-assign role thất bại
      console.error('Auto-assign COUNCIL_MEMBER role failed:', e)
    }
    const list = await SessionMember.query().where('session_id', params.id).orderBy('id', 'asc')
    const data = list.map((m) => ({ id: m.id, memberId: m.memberId, memberName: m.memberName, memberEmail: m.memberEmail, roleInCouncil: m.roleInCouncil, unit: m.unit }))
    return response.ok({ success: true, data })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const canManage = await CouncilPermissionService.canManageCouncil(user)
    if (!canManage) return response.forbidden({ success: false, message: 'Chỉ Phòng KH được xóa thành viên.' })
    const session = await CouncilSession.find(params.id)
    if (!session) return response.notFound({ success: false, message: 'Không tìm thấy phiên.' })
    if (session.status !== 'DRAFT') return response.badRequest({ success: false, message: 'Chỉ xóa được khi phiên DRAFT.' })
    const memberId = params.memberId
    const member = await SessionMember.query().where('session_id', params.id).where('member_id', memberId).first()
    if (!member) return response.notFound({ success: false, message: 'Không tìm thấy thành viên trong phiên.' })
    await member.delete()
    session.memberCount = Math.max(0, session.memberCount - 1)
    await session.save()
    return response.ok({ success: true, message: 'Đã xóa thành viên.' })
  }
}
