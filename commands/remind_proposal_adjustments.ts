import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ProposalAdjustmentService from '#services/proposal_adjustment_service'

/**
 * Nhắc hạn điều chỉnh đề xuất — ngày làm việc thứ 4 (US-03-05).
 * Chạy định kỳ (cron): node ace remind:proposal-adjustments
 */
export default class RemindProposalAdjustments extends BaseCommand {
  static commandName = 'remind:proposal-adjustments'
  static description = 'Gửi nhắc hạn điều chỉnh đề xuất (ngày LV thứ 4, không gửi lặp)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const sent = await ProposalAdjustmentService.sendDay4Reminders()
    this.logger.info(`Đã gửi ${sent} nhắc hạn điều chỉnh đề xuất.`)
  }
}
