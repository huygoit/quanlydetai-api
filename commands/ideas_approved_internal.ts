import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Idea from '#models/idea'

/**
 * Cập nhật status tất cả ý tưởng thành APPROVED_INTERNAL.
 */
export default class IdeasApprovedInternal extends BaseCommand {
  static commandName = 'ideas:approved-internal'
  static description = 'Update status tất cả ý tưởng thành APPROVED_INTERNAL'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const ideas = await Idea.all()
    this.logger.info(`Sẽ cập nhật ${ideas.length} ý tưởng thành APPROVED_INTERNAL`)

    for (const idea of ideas) {
      idea.status = 'APPROVED_INTERNAL'
      await idea.save()
      this.logger.info(`  ✓ ${idea.code} (id: ${idea.id})`)
    }

    this.logger.success(`Đã cập nhật ${ideas.length} ý tưởng.`)
  }
}