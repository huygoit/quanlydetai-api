import type { HttpContext } from '@adonisjs/core/http'
import ProjectBudgetService from '#services/project_budget_service'
import ProjectPaymentService from '#services/project_payment_service'
import ProjectProcurementService from '#services/project_procurement_service'
import ProjectProgressService from '#services/project_progress_service'
import ProjectAdjustmentService from '#services/project_adjustment_service'
import ProjectFinalService from '#services/project_final_service'
import { mapModule56Error } from '#utils/module56_http'

/**
 * API triển khai và đánh giá cuối kỳ (Module 5–6), trừ luồng ký hợp đồng.
 */
export default class ProjectModule56Controller {
  private async run(response: HttpContext['response'], work: () => Promise<unknown>, message?: string) {
    try {
      const data = await work()
      return response.ok({ success: true, message, data })
    } catch (err) {
      if (mapModule56Error(response, err)) return
      throw err
    }
  }

  async budgetShow({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () => ProjectBudgetService.snapshotFor(Number(params.outlineId), user.id))
  }

  async budgetSave({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const lines = request.input('lines', [])
    return this.run(response, () =>
      ProjectBudgetService.replaceLines(Number(params.id), user.id, lines)
    )
  }

  async payments({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectPaymentService.list(Number(request.input('outlineId')), user.id, request.input('status'))
    )
  }

  async paymentSave({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const submit = request.input('submit') === true || request.input('submit') === 'true'
    return this.run(response, () => ProjectPaymentService.save(user.id, request.body(), submit))
  }

  async paymentPkh({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectPaymentService.pkhAct(
        Number(params.id),
        user.id,
        request.input('action'),
        String(request.input('reason', ''))
      )
    )
  }

  async paymentTc({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectPaymentService.tcAct(
        Number(params.id),
        user.id,
        request.input('accept') !== false && request.input('accept') !== 'false',
        String(request.input('voucherNo', '')),
        String(request.input('voucherDate', '')),
        String(request.input('reason', ''))
      )
    )
  }

  async procurements({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectProcurementService.list(Number(request.input('outlineId')), user.id)
    )
  }

  async procurementSave({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const submit = request.input('submit') === true || request.input('submit') === 'true'
    return this.run(response, () => ProjectProcurementService.save(user.id, request.body(), submit))
  }

  async procurementPkh({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectProcurementService.pkhAct(
        Number(params.id),
        user.id,
        request.input('action'),
        String(request.input('reason', ''))
      )
    )
  }

  async procurementCsvc({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectProcurementService.csvcAct(
        Number(params.id),
        user.id,
        request.input('action'),
        String(request.input('method', '')),
        String(request.input('reason', ''))
      )
    )
  }

  async procurementReceive({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () => ProjectProcurementService.receive(Number(params.id), user.id))
  }

  async procurementTc({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectProcurementService.tcPay(
        Number(params.id),
        user.id,
        String(request.input('voucherNo', '')),
        String(request.input('voucherDate', '')),
        request.input('accept') !== false && request.input('accept') !== 'false',
        String(request.input('reason', ''))
      )
    )
  }

  async progress({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectProgressService.list(Number(request.input('outlineId')), user.id)
    )
  }

  async progressSave({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const submit = request.input('submit') === true || request.input('submit') === 'true'
    return this.run(response, () =>
      ProjectProgressService.save(
        Number(request.input('outlineId')),
        Number(params.periodId),
        user.id,
        request.body(),
        submit
      )
    )
  }

  async progressPkh({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectProgressService.pkhAction(
        Number(params.id),
        user.id,
        request.input('accept') === true || request.input('accept') === 'true',
        String(request.input('note', ''))
      )
    )
  }

  async adjustments({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectAdjustmentService.list(Number(request.input('outlineId')), user.id)
    )
  }

  async adjustmentSave({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const submit = request.input('submit') === true || request.input('submit') === 'true'
    return this.run(response, () => ProjectAdjustmentService.save(user.id, request.body(), submit))
  }

  async adjustmentPkh({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectAdjustmentService.pkhAct(
        Number(params.id),
        user.id,
        request.input('action'),
        String(request.input('note', ''))
      )
    )
  }

  async adjustmentLead({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () => ProjectAdjustmentService.leadConfirm(Number(params.id), user.id))
  }

  async adjustmentBgh({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectAdjustmentService.bghAct(
        Number(params.id),
        user.id,
        request.input('accept') === true || request.input('accept') === 'true',
        String(request.input('note', ''))
      )
    )
  }

  async finalShow({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () => ProjectFinalService.show(Number(params.outlineId), user.id))
  }

  async finalNotify({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () => ProjectFinalService.notify(Number(params.outlineId), user.id))
  }

  async finalDossier({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const submit = request.input('submit') === true || request.input('submit') === 'true'
    return this.run(response, () =>
      ProjectFinalService.saveDossier(Number(params.outlineId), user.id, request.body(), submit)
    )
  }

  async finalPkhDossier({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.pkhDossier(
        Number(params.outlineId),
        user.id,
        request.input('accept') === true || request.input('accept') === 'true',
        request.input('briefPagesOk') === true || request.input('briefPagesOk') === 'true',
        String(request.input('note', ''))
      )
    )
  }

  async finalCouncil({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.saveCouncil(Number(params.outlineId), user.id, request.body())
    )
  }

  async finalRemind({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.remindMember(Number(params.outlineId), user.id, Number(params.userId))
    )
  }

  async finalSheet({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.saveSheet(Number(params.outlineId), user.id, request.body())
    )
  }

  async finalMinutes({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.saveMinutes(Number(params.outlineId), user.id, request.body())
    )
  }

  async finalFail({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.decideFail(
        Number(params.outlineId),
        user.id,
        request.input('retry') === true || request.input('retry') === 'true'
      )
    )
  }

  async finalExplanation({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const submit = request.input('submit') === true || request.input('submit') === 'true'
    return this.run(response, () =>
      ProjectFinalService.saveExplanation(Number(params.outlineId), user.id, request.body(), submit)
    )
  }

  async finalExplanationConfirm({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.confirmExplanation(
        Number(params.outlineId),
        user.id,
        request.input('accept') === true || request.input('accept') === 'true',
        String(request.input('reason', ''))
      )
    )
  }

  async finalExtend({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.extendExplanation(
        Number(params.outlineId),
        user.id,
        String(request.input('deadline', ''))
      )
    )
  }

  async finalSettlement({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const submit = request.input('submit') === true || request.input('submit') === 'true'
    return this.run(response, () =>
      ProjectFinalService.saveSettlement(Number(params.outlineId), user.id, request.body(), submit)
    )
  }

  async finalSettlementPkh({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.pkhSettlement(
        Number(params.outlineId),
        user.id,
        request.input('accept') === true || request.input('accept') === 'true',
        String(request.input('note', ''))
      )
    )
  }

  async finalVariance({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.ackVariance(
        Number(params.outlineId),
        user.id,
        String(request.input('reason', ''))
      )
    )
  }

  async finalSettlementTc({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.tcSettlement(
        Number(params.outlineId),
        user.id,
        request.input('accept') === true || request.input('accept') === 'true',
        String(request.input('date', '')),
        String(request.input('reason', ''))
      )
    )
  }

  async finalLiquidationSave({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.saveLiquidation(Number(params.outlineId), user.id, request.body())
    )
  }

  async finalLiquidationSubmit({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.submitLiquidation(Number(params.outlineId), user.id)
    )
  }

  async finalLiquidationBgh({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.bghLiquidation(
        Number(params.outlineId),
        user.id,
        request.input('accept') === true || request.input('accept') === 'true',
        String(request.input('reason', ''))
      )
    )
  }

  async finalLiquidationPublish({ auth, params, request, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.publishLiquidation(
        Number(params.outlineId),
        user.id,
        String(request.input('issueNo', ''))
      )
    )
  }

  async finalLiquidationCnnv({ auth, params, response }: HttpContext) {
    const user = auth.use('api').user!
    return this.run(response, () =>
      ProjectFinalService.cnnvLiquidation(Number(params.outlineId), user.id)
    )
  }
}
