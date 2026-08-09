import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import CallForProposalService from '#services/call_for_proposal_service'

/**
 * Tiếp tục gửi email broadcast CFP (bỏ qua mail đã SENT).
 * VD: node ace cfp:resume-broadcast 4
 */
export default class ResumeCfpBroadcast extends BaseCommand {
  static commandName = 'cfp:resume-broadcast'
  static description = 'Tiếp tục / gửi lại email broadcast sau phát hành CFP'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'ID call_for_proposals' })
  declare id: string

  async run() {
    const cfpId = Number(this.id)
    if (!Number.isFinite(cfpId) || cfpId <= 0) {
      this.logger.error('ID không hợp lệ')
      this.exitCode = 1
      return
    }
    this.logger.info(`Đẩy resume broadcast CFP #${cfpId} vào BullMQ …`)
    try {
      await CallForProposalService.resumeBroadcast(cfpId)
      this.logger.success(
        'Đã đẩy job vào queue. Đảm bảo Redis + `npm run worker:cfp-email` đang chạy.'
      )
    } catch (e) {
      this.logger.error(e instanceof Error ? e.message : String(e))
      this.exitCode = 1
    }
  }
}
