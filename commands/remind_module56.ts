import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ProjectProgressService from '#services/project_progress_service'
import ProjectFinalService from '#services/project_final_service'

/**
 * Nhắc báo cáo tiến độ (30/14/7/3 ngày) và giải trình BM.13 (ngày 10, 13).
 * Chạy định kỳ: node ace remind:module56
 */
export default class RemindModule56 extends BaseCommand {
  static commandName = 'remind:module56'
  static description = 'Nhắc hạn báo cáo tiến độ và hoàn thiện hồ sơ đánh giá cuối kỳ'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const progress = await ProjectProgressService.sendReminders()
    const explanation = await ProjectFinalService.sendExplanationReminders()
    this.logger.info(`Đã gửi ${progress} nhắc tiến độ, ${explanation} nhắc giải trình.`)
  }
}
