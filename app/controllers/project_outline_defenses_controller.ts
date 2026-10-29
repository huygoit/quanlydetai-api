import type { HttpContext } from '@adonisjs/core/http'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import ProjectOutlineDefenseScoreSheet from '#models/project_outline_defense_score_sheet'
import ScientificProfile from '#models/scientific_profile'
import PermissionService from '#services/permission_service'
import ProjectOutlineDefenseService from '#services/project_outline_defense_service'
import ProjectOutlineAppraisalService from '#services/project_outline_appraisal_service'
import ProjectOutlineMinutesService from '#services/project_outline_minutes_service'
import {
  createDefenseSessionValidator,
  updateDefenseSessionValidator,
  cancelDefenseSessionValidator,
  saveDefenseMinutesValidator,
  finalizeDefenseValidator,
  bghSignDefenseValidator,
  saveBm05aValidator,
} from '#validators/project_outline_defense_validator'

/**
 * Tổ chức thẩm định thuyết minh — flow 6 bước (QĐ → BGH → TC-HC → BM.05a).
 */
export default class ProjectOutlineDefensesController {
  private async assertPkh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.defense_manage')) ||
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  private async assertBgh(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.outline_approve'))
    )
  }

  private async assertTchc(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.contract_publish')) ||
      (await PermissionService.userHasPermission(userId, 'project.budget_confirm'))
    )
  }

  private async loadSession(id: number) {
    return ProjectOutlineDefenseSession.query().where('id', id).preload('members').first()
  }

  /** GET /api/project-outline-defenses/eligible */
  async eligible({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const data = await ProjectOutlineAppraisalService.listEligible()
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outline-defenses/my-tasks — thành viên HĐ */
  async myTasks({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const data = await ProjectOutlineAppraisalService.listMyTasks(user.id)
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outline-defenses */
  async index({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const isPkh = await this.assertPkh(user.id)
    const isBgh = await this.assertBgh(user.id)
    const isTchc = await this.assertTchc(user.id)
    if (!isPkh && !isBgh && !isTchc) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }

    let statuses = [
      'DRAFT',
      'PENDING_BGH',
      'BGH_SIGNED',
      'PUBLISHED',
      'CONFIRMED',
      'FINALIZED',
    ]
    if (!isPkh && isBgh) statuses = ['PENDING_BGH', 'BGH_SIGNED', 'PUBLISHED', 'FINALIZED']
    if (!isPkh && !isBgh && isTchc) statuses = ['BGH_SIGNED', 'PUBLISHED', 'FINALIZED']

    const rows = await ProjectOutlineDefenseSession.query()
      .whereIn('status', statuses)
      .orderBy('meeting_at', 'desc')
      .limit(200)

    const data = []
    for (const s of rows) {
      data.push(await ProjectOutlineAppraisalService.serializeFull(s))
    }
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outline-defenses/:id */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy phiên thẩm định.' })
    }
    const isPkh = await this.assertPkh(user.id)
    const isBgh = await this.assertBgh(user.id)
    const isTchc = await this.assertTchc(user.id)
    const isMember = (session.members || []).some((m) => Number(m.userId) === Number(user.id))
    if (!isPkh && !isBgh && !isTchc && !isMember) {
      return response.forbidden({ success: false, message: 'Không có quyền xem.' })
    }
    return response.ok({
      success: true,
      data: await ProjectOutlineAppraisalService.serializeFull(session),
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

  /** GET /api/project-outline-defenses/:id/score-progress */
  async scoreProgress({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const session = await ProjectOutlineDefenseSession.find(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const data = await ProjectOutlineAppraisalService.listScoreProgress(session.id)
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
      const result = await ProjectOutlineAppraisalService.createSession(user.id, payload as any)
      return response.ok({
        success: true,
        message: 'Đã tạo phiên thẩm định (nháp).',
        data: await ProjectOutlineAppraisalService.serializeFull(result.session),
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
        message: e?.message || 'Tạo phiên thất bại.',
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
    const payload = await request.validateUsing(updateDefenseSessionValidator)
    try {
      await ProjectOutlineAppraisalService.updateDraft(session, user.id, payload as any)
      return response.ok({
        success: true,
        message: 'Đã cập nhật phiên nháp.',
        data: await ProjectOutlineAppraisalService.serializeFull(session),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Cập nhật thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/submit-bgh — bước 3 */
  async submitBgh({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    try {
      await ProjectOutlineAppraisalService.submitToBgh(session, user.id)
      return response.ok({
        success: true,
        message: 'Đã tạo dự thảo QĐ và trình BGH ký số.',
        data: await ProjectOutlineAppraisalService.serializeFull(session),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Trình BGH thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/bgh-sign — bước 4a */
  async bghSign({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertBgh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ BGH ký QĐ.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(bghSignDefenseValidator)
    try {
      await ProjectOutlineAppraisalService.bghSign(session, user.id, payload.note)
      return response.ok({
        success: true,
        message: 'BGH đã ký số QĐ thành lập HĐ.',
        data: await ProjectOutlineAppraisalService.serializeFull(session),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Ký thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/publish — bước 4b TC-HC */
  async publish({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertTchc(user.id)) && !(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ TC-HC phát hành (hoặc PKH hỗ trợ).' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    try {
      await ProjectOutlineAppraisalService.publish(session, user.id)
      return response.ok({
        success: true,
        message: 'Đã phát hành QĐ — đã gửi mời và mở phiếu BM.05a.',
        data: await ProjectOutlineAppraisalService.serializeFull(session),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Phát hành thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/remind/:memberId */
  async remind({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    try {
      const result = await ProjectOutlineAppraisalService.remindMember(
        session,
        Number(params.memberId),
        user.id
      )
      return response.ok({
        success: true,
        message: `Đã gửi nhắc (${result.reminded} phiếu chưa nộp).`,
        data: result,
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Nhắc thất bại.',
      })
    }
  }

  /** GET /api/project-outline-defenses/score-sheets/:sheetId */
  async showScoreSheet({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    try {
      const data = await ProjectOutlineAppraisalService.getMySheet(Number(params.sheetId), user.id)
      return response.ok({ success: true, data })
    } catch (e: any) {
      // PKH xem hộ (kèm hồ sơ TM)
      if (await this.assertPkh(user.id)) {
        try {
          const data = await ProjectOutlineAppraisalService.getSheetForPkh(Number(params.sheetId))
          return response.ok({ success: true, data })
        } catch (err: any) {
          return response.notFound({
            success: false,
            message: err?.message || 'Không tìm thấy phiếu.',
          })
        }
      }
      return response.forbidden({ success: false, message: e?.message || 'Không có quyền.' })
    }
  }

  /** PUT /api/project-outline-defenses/score-sheets/:sheetId */
  async saveScoreSheet({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const sheet = await ProjectOutlineDefenseScoreSheet.find(Number(params.sheetId))
    if (!sheet) {
      return response.notFound({ success: false, message: 'Không tìm thấy phiếu.' })
    }
    const payload = await request.validateUsing(saveBm05aValidator)
    try {
      const saved = await ProjectOutlineAppraisalService.saveBm05a(sheet, user.id, payload as any)
      return response.ok({
        success: true,
        message: payload.submit ? 'Đã nộp phiếu BM.05a.' : 'Đã lưu nháp BM.05a.',
        data: ProjectOutlineAppraisalService.serializeScoreSheet(saved),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Lưu phiếu thất bại.',
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
      return response.ok({
        success: true,
        message: 'Đã hủy phiên thẩm định.',
        data: await ProjectOutlineAppraisalService.serializeFull(saved),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Hủy thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/open-early-meeting — PKH xác nhận họp trước lịch */
  async openEarlyMeeting({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.assertPkh(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH xác nhận họp trước.' })
    }
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    try {
      await ProjectOutlineMinutesService.openEarlyMeeting(session, user.id)
      await session.refresh()
      return response.ok({
        success: true,
        message: 'Đã xác nhận họp trước ngày dự kiến — Thư ký được soạn biên bản.',
        data: await ProjectOutlineAppraisalService.serializeFull(session),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Xác nhận thất bại.',
      })
    }
  }

  /** GET /api/project-outline-defenses/:id/minutes — ngữ cảnh biên bản BM-02.10 */
  async minutesContext({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const isPkh = await this.assertPkh(user.id)
    const isMember = (session.members || []).some((m) => Number(m.userId) === Number(user.id))
    if (!isPkh && !isMember) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    try {
      const data = await ProjectOutlineMinutesService.getMinutesContext(session)
      let isThuKy = false
      try {
        await ProjectOutlineMinutesService.assertThuKy(session.id, user.id)
        isThuKy = true
      } catch {
        isThuKy = false
      }
      return response.ok({ success: true, data: { ...data, isThuKy } })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Không tải được biên bản.',
      })
    }
  }

  /** PUT /api/project-outline-defenses/:id/minutes — Thư ký lưu nháp */
  async saveMinutes({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(saveDefenseMinutesValidator)
    try {
      const data = await ProjectOutlineMinutesService.saveDraft(session, user.id, payload as any)
      return response.ok({
        success: true,
        message: 'Đã lưu nháp biên bản.',
        data: { ...data, isThuKy: true },
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Lưu thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/reopen-minutes — PKH hoặc Thư ký mở khóa (BGH chưa ký) */
  async reopenMinutes({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const isPkh = await this.assertPkh(user.id)
    let isThuKy = false
    try {
      await ProjectOutlineMinutesService.assertThuKy(session.id, user.id)
      isThuKy = true
    } catch {
      isThuKy = false
    }
    if (!isPkh && !isThuKy) {
      return response.forbidden({
        success: false,
        message: 'Chỉ PKH hoặc Thư ký hội đồng được mở khóa biên bản.',
      })
    }
    const reason = String(request.input('reason') || '').trim() || null
    try {
      const data = await ProjectOutlineMinutesService.reopenMinutes(session, user.id, reason)
      return response.ok({
        success: true,
        message: 'Đã mở khóa biên bản — có thể cập nhật và chốt lại.',
        data: { ...data, isThuKy },
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Mở khóa thất bại.',
      })
    }
  }

  /** POST /api/project-outline-defenses/:id/finalize — Thư ký chốt biên bản */
  async finalize({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const session = await this.loadSession(Number(params.id))
    if (!session) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(finalizeDefenseValidator)
    try {
      const data = await ProjectOutlineMinutesService.finalize(session, user.id, payload as any)
      return response.ok({
        success: true,
        message: 'Đã chốt biên bản thẩm định (BM.05b).',
        data: { ...data, isThuKy: true },
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Chốt thất bại.',
      })
    }
  }
}
