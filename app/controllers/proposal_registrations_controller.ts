import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import ProposalRegistrationService, { LoiHoSoDangKy } from '#services/proposal_registration_service'
import ProposalRegistrationReviewService from '#services/proposal_registration_review_service'

const thamSoValidator = vine.compile(
  vine.object({
    callForProposalId: vine.number().positive(),
    projectProposalId: vine.number().positive(),
  })
)

const luuValidator = vine.compile(
  vine.object({
    callForProposalId: vine.number().positive(),
    projectProposalId: vine.number().positive(),
    proposedBudget: vine.number().min(0),
    durationMonths: vine.number().min(1).max(60),
    attachmentUrl: vine.string().trim().maxLength(500).optional().nullable(),
    note: vine.string().trim().maxLength(2000).optional().nullable(),
    gui: vine.boolean().optional(),
  })
)

const xacNhanValidator = vine.compile(
  vine.object({
    note: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)

const chapThuanValidator = vine.compile(
  vine.object({
    registrationId: vine.number().positive(),
    reason: vine.string().trim().maxLength(2000).optional().nullable(),
  })
)

const lyDoValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(2000),
  })
)

const traLaiValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(1).maxLength(2000),
  })
)

export default class ProposalRegistrationsController {
  /** GET /api/proposal-registrations/context */
  async context({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const q = await thamSoValidator.validate({
      callForProposalId: Number(request.input('callForProposalId')),
      projectProposalId: Number(request.input('projectProposalId')),
    })
    try {
      const data = await ProposalRegistrationService.nguCanh(
        user.id,
        q.callForProposalId,
        q.projectProposalId
      )
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** GET /api/proposal-registrations/pending-count */
  async pendingCount({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const count = await ProposalRegistrationService.demChoDonVi(user)
    return response.ok({ success: true, data: { count } })
  }

  /** GET /api/proposal-registrations/pkh-pending — đơn đã được đơn vị xác nhận */
  async pkhPending({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    try {
      const items = await ProposalRegistrationService.danhSachChoPkh(user)
      return response.ok({ success: true, data: items, coTheXuLy: false })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** GET /api/proposal-registrations/pending */
  async pending({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    try {
      const data = await ProposalRegistrationService.danhSachChoDonVi(user)
      return response.ok({ success: true, data: data.items, coTheXuLy: data.coTheXuLy })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** GET /api/proposal-registrations/pkh-tasks */
  async pkhTasks({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    try {
      const data = await ProposalRegistrationReviewService.danhSachNhiemVu(user)
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** GET /api/proposal-registrations/pkh-tasks/:proposalId */
  async pkhTaskShow({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    try {
      const data = await ProposalRegistrationReviewService.soSanh(user, Number(params.proposalId))
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** POST /api/proposal-registrations/pkh-tasks/:proposalId/accept */
  async pkhAccept({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const body = await request.validateUsing(chapThuanValidator)
    try {
      const data = await ProposalRegistrationReviewService.chapThuan(
        user,
        Number(params.proposalId),
        body.registrationId,
        body.reason || ''
      )
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** POST /api/proposal-registrations/pkh-tasks/:proposalId/assign */
  async pkhAssign({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    try {
      const data = await ProposalRegistrationReviewService.phanCong(user, Number(params.proposalId))
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** POST /api/proposal-registrations/pkh-tasks/:proposalId/close */
  async pkhClose({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const body = await request.validateUsing(lyDoValidator)
    try {
      const data = await ProposalRegistrationReviewService.dongDangKy(
        user,
        Number(params.proposalId),
        body.reason
      )
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** PATCH /api/proposal-registrations/:id/pkh-reason */
  async pkhReason({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const body = await request.validateUsing(lyDoValidator)
    try {
      const data = await ProposalRegistrationReviewService.suaLyDo(
        user,
        Number(params.id),
        body.reason
      )
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** GET /api/proposal-registrations/:id */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    try {
      const data = await ProposalRegistrationService.chiTietChoDonVi(user, Number(params.id))
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** POST /api/proposal-registrations/:id/confirm */
  async confirm({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const body = await request.validateUsing(xacNhanValidator)
    try {
      const data = await ProposalRegistrationService.xacNhan(user, Number(params.id), body.note)
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** POST /api/proposal-registrations/:id/return */
  async returnToDraft({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const body = await request.validateUsing(traLaiValidator)
    try {
      const data = await ProposalRegistrationService.traLai(user, Number(params.id), body.reason)
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  /** POST /api/proposal-registrations */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const body = await request.validateUsing(luuValidator)
    const members = request.input('members')
    try {
      const data = await ProposalRegistrationService.luu(user, {
        callForProposalId: body.callForProposalId,
        projectProposalId: body.projectProposalId,
        proposedBudget: body.proposedBudget,
        durationMonths: body.durationMonths,
        attachmentUrl: body.attachmentUrl,
        note: body.note,
        members: Array.isArray(members) ? members : [],
        gui: body.gui === true,
      })
      return response.ok({ success: true, data })
    } catch (error) {
      return this.loi(error, response)
    }
  }

  private loi(error: unknown, response: HttpContext['response']) {
    if (error instanceof LoiHoSoDangKy) {
      return response.unprocessableEntity({ success: false, message: error.message })
    }
    throw error
  }
}
