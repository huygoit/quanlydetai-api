import type { HttpContext } from '@adonisjs/core/http'

/**
 * US-04-06 đã ngừng — luồng xác nhận kinh phí bỏ.
 * Thông qua / hoàn thiện TM → PKH → HĐ → BGH → Module 5.
 */
export default class ProjectOutlineBudgetsController {
  private hetHieuLuc({ response }: HttpContext) {
    return response.status(410).send({
      success: false,
      message:
        'Nghiệp vụ xác nhận kinh phí (US-04-06) đã ngừng. Bản hoàn thiện duyệt theo luồng PKH → Hội đồng → BGH.',
    })
  }

  async index(ctx: HttpContext) {
    return this.hetHieuLuc(ctx)
  }

  async show(ctx: HttpContext) {
    return this.hetHieuLuc(ctx)
  }

  async pkhPropose(ctx: HttpContext) {
    return this.hetHieuLuc(ctx)
  }

  async tcAction(ctx: HttpContext) {
    return this.hetHieuLuc(ctx)
  }

  async ldDecide(ctx: HttpContext) {
    return this.hetHieuLuc(ctx)
  }
}
