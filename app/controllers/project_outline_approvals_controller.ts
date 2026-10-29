import type { HttpContext } from '@adonisjs/core/http'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineFinalApprovalService from '#services/project_outline_final_approval_service'

/**
 * Phê duyệt cuối US-04: BGH → TC-HC phát hành QĐ giao thực hiện.
 */
export default class ProjectOutlineApprovalsController {
  async index({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await ProjectOutlineFinalApprovalService.canView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền xem hàng chờ phê duyệt.' })
    }
    const scope = String(request.input('scope', 'bgh')) as 'bgh' | 'hc' | 'done'
    if (!['bgh', 'hc', 'done'].includes(scope)) {
      return response.unprocessableEntity({ success: false, message: 'scope không hợp lệ.' })
    }
    const data = await ProjectOutlineFinalApprovalService.list(scope)
    return response.ok({ success: true, data })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    if (!(await ProjectOutlineFinalApprovalService.canView(user.id))) {
      return response.forbidden({ success: false, message: 'Không có quyền xem hồ sơ.' })
    }
    const data = await ProjectOutlineFinalApprovalService.getDossier(Number(params.id))
    if (!data) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    return response.ok({
      success: true,
      data: {
        ...data,
        permissions: {
          canBgh: await ProjectOutlineFinalApprovalService.canBgh(user.id),
          canHc: await ProjectOutlineFinalApprovalService.canHc(user.id),
        },
      },
    })
  }

  async bghApprove({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await ProjectOutline.find(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const approvedBudget = Number(request.input('approvedBudget'))
    const note = request.input('note')
    try {
      const result = await ProjectOutlineFinalApprovalService.bghApprove(outline, user.id, {
        approvedBudget,
        note: note == null ? null : String(note),
      })
      const dossier = await ProjectOutlineFinalApprovalService.getDossier(outline.id)
      return response.ok({
        success: true,
        message: result.idempotent
          ? 'Hồ sơ đã được BGH ký trước đó.'
          : 'BGH đã ký phê duyệt — chờ TC-HC phát hành QĐ giao thực hiện.',
        data: dossier,
      })
    } catch (e: any) {
      const status = String(e?.message || '').includes('Không có quyền') ? 403 : 422
      return response.status(status).send({
        success: false,
        message: e?.message || 'Phê duyệt thất bại.',
      })
    }
  }

  async bghReject({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await ProjectOutline.find(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    try {
      const result = await ProjectOutlineFinalApprovalService.bghReject(
        outline,
        user.id,
        String(request.input('reason', ''))
      )
      const dossier = await ProjectOutlineFinalApprovalService.getDossier(outline.id)
      return response.ok({
        success: true,
        message: result.idempotent ? 'Hồ sơ đã bị từ chối trước đó.' : 'Đã từ chối phê duyệt.',
        data: dossier,
      })
    } catch (e: any) {
      const status = String(e?.message || '').includes('Không có quyền') ? 403 : 422
      return response.status(status).send({
        success: false,
        message: e?.message || 'Từ chối thất bại.',
      })
    }
  }

  async hcPublish({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const outline = await ProjectOutline.find(Number(params.id))
    if (!outline) {
      return response.notFound({ success: false, message: 'Không tìm thấy thuyết minh.' })
    }
    const decisionFileUrl = request.input('decisionFileUrl')
    try {
      const result = await ProjectOutlineFinalApprovalService.hcPublish(outline, user.id, {
        decisionFileUrl: decisionFileUrl == null ? null : String(decisionFileUrl),
      })
      const dossier = await ProjectOutlineFinalApprovalService.getDossier(outline.id)
      return response.ok({
        success: true,
        message: result.idempotent
          ? 'QĐ đã phát hành trước đó.'
          : 'Đã phát hành QĐ giao thực hiện — mở Module 5.',
        data: dossier,
      })
    } catch (e: any) {
      const status = String(e?.message || '').includes('Không có quyền') ? 403 : 422
      return response.status(status).send({
        success: false,
        message: e?.message || 'Phát hành thất bại.',
      })
    }
  }
}
