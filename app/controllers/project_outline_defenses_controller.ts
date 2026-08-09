import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import ScientificProfile from '#models/scientific_profile'
import PermissionService from '#services/permission_service'
import ProjectOutlineDefenseService from '#services/project_outline_defense_service'
import ProjectOutlineService from '#services/project_outline_service'
import {
  createDefenseSessionValidator,
  updateDefenseSessionValidator,
  cancelDefenseSessionValidator,
  saveDefenseMinutesValidator,
  finalizeDefenseValidator,
  confirmDefenseValidator,
} from '#validators/project_outline_defense_validator'

/**
 * US-04-04 — PKH tổ chức bảo vệ thuyết minh.
 */
export default class ProjectOutlineDefensesController {
  private async assertPkh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.defense_manage')) ||
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  private async loadSession(id: number) {
    return ProjectOutlineDefenseSession.query()
      .where('id', id)
      .preload('members')
      .first()
  }

  /** GET /api/project-outline-defenses/eligible */
  async eligible({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const data = await ProjectOutlineDefenseService.listEligible()
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outline-defenses */
  async index({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const rows = await ProjectOutlineDefenseSession.query()
      .whereIn('status', ['DRAFT', 'CONFIRMED', 'FINALIZED'])
      .orderBy('meeting_at', 'desc')
      .limit(200)

    const data = []
    for (const s of rows) {
      await s.load('members')
      const outline = await ProjectOutline.find(s.projectOutlineId)
      data.push(ProjectOutlineDefenseService.serializeSession(s, s.members, outline))
    }
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outline-defenses/:id */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy buổi bảo vệ.' })
    }
    const isPkh = await this.assertPkh(user.id)
    const isMember = (session.members || []).some((m) => Number(m.userId) === Number(user.id))
    const outline = await ProjectOutline.find(session.projectOutlineId)
    const isOwner = outline && Number(outline.ownerId) === Number(user.id)
    if (!isPkh && !isMember && !isOwner) {
      return response.forbidden({ success: false, message: 'Không có quyền xem.' })
    }
    return response.ok({
      success: true,
      data: ProjectOutlineDefenseService.serializeSession(session, session.members, outline),
    })
  }

  /** GET /api/project-outline-defenses/:id/available-members */
  async availableMembers({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const session = await ProjectOutlineDefenseSession.find(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const existing = await ProjectOutlineDefenseMember.query()
      .where('session_id', session.id)
      .select('scientific_profile_id', 'user_id')
    const usedProfiles = new Set(
      existing.map((m) => m.scientificProfileId).filter((x): x is number => !!x)
    )
    const keyword = String(request.input('keyword', '') || '').trim()
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
        'department'
      )
      .whereNotNull('user_id')
      .limit(30)
    if (keyword) {
      q.where((b) => {
        b.whereILike('full_name', `%${keyword}%`)
          .orWhereILike('work_email', `%${keyword}%`)
          .orWhereILike('organization', `%${keyword}%`)
      })
    }
    const rows = await q
    const data = rows
      .filter((p) => !usedProfiles.has(p.id))
      .map((p) => ({
        scientificProfileId: p.id,
        userId: p.userId,
        memberName: p.fullName,
        memberEmail: p.workEmail,
        unit: [p.organization, p.faculty, p.department].filter(Boolean).join(' — ') || null,
        degree: p.degree,
        academicTitle: p.academicTitle,
        isExternal: false,
      }))
    return response.ok({ success: true, data })
  }

  /** POST /api/project-outline-defenses */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const payload = await request.validateUsing(createDefenseSessionValidator)
    try {
      const result = await ProjectOutlineDefenseService.createSession(user.id, payload as any)
      return response.ok({
        success: true,
        message: payload.confirm ? 'Đã xác nhận lịch bảo vệ.' : 'Đã tạo lịch nháp.',
        data: ProjectOutlineDefenseService.serializeSession(
          result.session,
          result.members,
          result.outline
        ),
      })
    } catch (e: any) {
      if (e?.code === 'LESS_THAN_5_BUSINESS_DAYS') {
        return response.unprocessableEntity({
          success: false,
          code: e.code,
          message: e.message,
        })
      }
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Tạo lịch thất bại.',
      })
    }
  }

  /** PUT /api/project-outline-defenses/:id */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    if (session.status !== 'DRAFT' && session.status !== 'CONFIRMED') {
      return response.badRequest({ success: false, message: 'Không sửa được buổi này.' })
    }
    if (session.status === 'CONFIRMED') {
      // Cho phép cập nhật nhẹ + gửi lại thông báo — vẫn audit
    }
    const payload = await request.validateUsing(updateDefenseSessionValidator)
    try {
      if (payload.meetingMode) session.meetingMode = payload.meetingMode
      if (payload.meetingAt) {
        const d = DateTime.fromISO(payload.meetingAt)
        if (!d.isValid) throw new Error('meetingAt không hợp lệ.')
        session.meetingAt = d
      }
      if (payload.location !== undefined) session.location = payload.location
      if (payload.meetingUrl !== undefined) session.meetingUrl = payload.meetingUrl
      ProjectOutlineDefenseService.validateMeetingFields(
        session.meetingMode,
        session.location,
        session.meetingUrl
      )
      await session.save()

      let members = session.members || []
      if (payload.members) {
        ProjectOutlineDefenseService.validateCouncilComposition(payload.members as any)
        await ProjectOutlineDefenseService.assertNoConflict(
          session.projectOutlineId,
          payload.members as any
        )
        await ProjectOutlineDefenseService.assertNoScheduleConflict(
          session.meetingAt,
          payload.members as any,
          session.id
        )
        members = await ProjectOutlineDefenseService.replaceMembers(
          session.id,
          payload.members as any
        )
      }

      await ProjectOutlineService.writeAudit(
        session.projectOutlineId,
        user.id,
        'UPDATE_DEFENSE_SESSION',
        null,
        null,
        { sessionId: session.id }
      )

      if (session.status === 'CONFIRMED') {
        const outline = await ProjectOutline.findOrFail(session.projectOutlineId)
        outline.defenseScheduledAt = session.meetingAt
        await outline.save()
        await ProjectOutlineDefenseService.notifyInvite(session, outline, members)
      }

      const outline = await ProjectOutline.find(session.projectOutlineId)
      return response.ok({
        success: true,
        message: 'Đã cập nhật lịch bảo vệ.',
        data: ProjectOutlineDefenseService.serializeSession(session, members, outline),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Cập nhật thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/confirm */
  async confirm({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(confirmDefenseValidator)
    try {
      const outline = await ProjectOutline.findOrFail(session.projectOutlineId)
      const result = await ProjectOutlineDefenseService.confirmSession(
        session,
        outline,
        session.members || [],
        user.id,
        payload
      )
      return response.ok({
        success: true,
        message: 'Đã xác nhận lịch bảo vệ — đã gửi lời mời.',
        data: ProjectOutlineDefenseService.serializeSession(
          result.session,
          result.members,
          result.outline
        ),
      })
    } catch (e: any) {
      if (e?.code === 'LESS_THAN_5_BUSINESS_DAYS') {
        return response.unprocessableEntity({
          success: false,
          code: e.code,
          message: e.message,
        })
      }
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Xác nhận thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/cancel */
  async cancel({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(cancelDefenseSessionValidator)
    try {
      const saved = await ProjectOutlineDefenseService.cancelSession(
        session,
        user.id,
        payload.reason
      )
      const outline = await ProjectOutline.find(saved.projectOutlineId)
      await saved.load('members')
      return response.ok({
        success: true,
        message: 'Đã hủy buổi bảo vệ.',
        data: ProjectOutlineDefenseService.serializeSession(saved, saved.members, outline),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Hủy thất bại.',
      })
    }
  }

  /** PUT /api/project-outline-defenses/:id/minutes */
  async saveMinutes({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH/Thư ký được phân quyền.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(saveDefenseMinutesValidator)
    try {
      const saved = await ProjectOutlineDefenseService.saveMinutes(session, payload as any, user.id)
      await saved.load('members')
      const outline = await ProjectOutline.find(saved.projectOutlineId)
      return response.ok({
        success: true,
        message: 'Đã lưu nháp biên bản.',
        data: ProjectOutlineDefenseService.serializeSession(saved, saved.members, outline),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Lưu thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/finalize */
  async finalize({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(finalizeDefenseValidator)
    try {
      const result = await ProjectOutlineDefenseService.finalize(
        session,
        payload as any,
        user.id
      )
      return response.ok({
        success: true,
        message: 'Đã chốt biên bản bảo vệ.',
        data: ProjectOutlineDefenseService.serializeSession(
          result.session,
          result.members,
          result.outline
        ),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Chốt thất bại.',
      })
    }
  }
}
