import type { HttpContext } from '@adonisjs/core/http'
import ProjectOutline from '#models/project_outline'
import PermissionService from '#services/permission_service'
import ProjectOutlineBudgetService from '#services/project_outline_budget_service'
import ProjectOutlineService from '#services/project_outline_service'
import {
  pkhProposeBudgetValidator,
  tcBudgetActionValidator,
  ldBudgetDecisionValidator,
} from '#validators/project_outline_budget_validator'

/**
 * US-04-06 — Xác nhận kinh phí (PKH→TC) và LĐ phê duyệt.
 */
export default class ProjectOutlineBudgetsController {
  private async canPkhPropose(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.budget_propose')) ||
      (await PermissionService.userHasPermission(userId, 'project.review')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_manage'))
    )
  }

  private async canTcConfirm(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.budget_confirm')) ||
      (await PermissionService.userHasPermission(userId, 'project.liquidation'))
    )
  }

  private async canLdApprove(userId: number) {
    return (
      (await PermissionService.userHasPermission(userId, 'project.outline_approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.approve')) ||
      (await PermissionService.userHasPermission(userId, 'project.selection_approve'))
    )
  }

  private async canView(userId: number) {
    return (
      (await this.canPkhPropose(userId)) ||
      (await this.canTcConfirm(userId)) ||
      (await this.canLdApprove(userId))
    )
  }

  /** GET /api/project-outline-budgets?scope=pkh|tc|ld */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const scope = String(request.input('scope', 'pkh')) as 'pkh' | 'tc' | 'ld'
    if (scope === 'pkh' && !(await this.canPkhPropose(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền PKH.' })
    }
    if (scope === 'tc' && !(await this.canTcConfirm(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền TC.' })
    }
    if (scope === 'ld' && !(await this.canLdApprove(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền LĐ.' })
    }
    const data = await ProjectOutlineBudgetService.listByScope(scope)
    return response.ok({ success: true, data })
  }

  /** GET /api/project-outline-budgets/:outlineId */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền.' })
    }
    const outline = await ProjectOutline.query()
      .where('id', Number(params.outlineId))
      .preload('budgetLines')
      .first()
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const conf = await ProjectOutlineBudgetService.getOrCreateDraft(outline)
    return response.ok({
      success: true,
      data: {
        ...ProjectOutlineBudgetService.serialize(conf, outline),
        outlineDetail: ProjectOutlineService.serialize(outline),
        roles: {
          canPkhPropose: await this.canPkhPropose(user.id),
          canTcConfirm: await this.canTcConfirm(user.id),
          canLdApprove: await this.canLdApprove(user.id),
        },
      },
    })
  }

  /** POST /api/project-outline-budgets/:outlineId/pkh-propose */
  async pkhPropose({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canPkhPropose(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ PKH đề xuất kinh phí.' })
    }
    const outline = await ProjectOutline.find(Number(params.outlineId))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(pkhProposeBudgetValidator)
    try {
      const row = await ProjectOutlineBudgetService.pkhPropose(outline, user.id, payload as any)
      await outline.refresh()
      return response.ok({
        success: true,
        message: payload.sendToTc
          ? 'Đã gửi TC thẩm tra kinh phí.'
          : 'Đã lưu đề xuất kinh phí.',
        data: ProjectOutlineBudgetService.serialize(row, outline),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Thất bại.',
      })
    }
  }

  /** POST /api/project-outline-budgets/:outlineId/tc-action */
  async tcAction({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canTcConfirm(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ TC thẩm tra kinh phí.' })
    }
    const outline = await ProjectOutline.find(Number(params.outlineId))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(tcBudgetActionValidator)
    try {
      const row = await ProjectOutlineBudgetService.tcAction(outline, user.id, payload as any)
      await outline.refresh()
      return response.ok({
        success: true,
        message:
          payload.action === 'RETURN'
            ? 'Đã trả lại PKH.'
            : 'Đã xác nhận kinh phí — chuyển LĐ phê duyệt.',
        data: ProjectOutlineBudgetService.serialize(row, outline),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Thất bại.',
      })
    }
  }

  /** POST /api/project-outline-budgets/:outlineId/ld-decide */
  async ldDecide({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await this.canLdApprove(user.id))) {
      return response.forbidden({ success: false, message: 'Chỉ Lãnh đạo phê duyệt.' })
    }
    const outline = await ProjectOutline.find(Number(params.outlineId))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy.' })
    }
    const payload = await request.validateUsing(ldBudgetDecisionValidator)
    try {
      const result = await ProjectOutlineBudgetService.ldDecide(
        outline,
        user.id,
        payload as any
      )
      await result.outline.refresh()
      return response.ok({
        success: true,
        message: result.idempotent
          ? 'Quyết định đã được ghi nhận trước đó.'
          : payload.decision === 'APPROVE'
            ? 'Đã phê duyệt — mở Module 5.'
            : payload.decision === 'REJECT'
              ? 'Đã ghi nhận không phê duyệt.'
              : 'Đã trả về xem xét lại.',
        data: ProjectOutlineBudgetService.serialize(result.row, result.outline),
      })
    } catch (e: any) {
      return response.unprocessableEntity({
        success: false,
        message: e?.message || 'Thất bại.',
      })
    }
  }
}
