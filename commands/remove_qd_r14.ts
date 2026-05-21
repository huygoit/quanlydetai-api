import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Publication from '#models/publication'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'

const CODE = 'QD_R14'
/** Chuyển công bố cũ sang lá 1 điểm nếu đang gắn QD_R14 */
const FALLBACK_CODE = 'QD_R14_P100'

export default class RemoveQdR14 extends BaseCommand {
  static commandName = 'remove:qd-r14'
  static description = 'Xóa loại QD_R14 (chuyển publication sang QD_R14_P100 nếu có)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const type = await ResearchOutputType.query().where('code', CODE).first()
    if (!type) {
      this.logger.warning(`Không có ${CODE} trong DB.`)
      return
    }

    const fallback = await ResearchOutputType.query().where('code', FALLBACK_CODE).first()
    const pubCount = await Publication.query().where('research_output_type_id', type.id).count('* as total')
    const n = Number(pubCount[0]?.$extras?.total ?? 0)

    if (n > 0) {
      if (!fallback) {
        this.logger.error(`Có ${n} công bố gắn ${CODE} nhưng chưa có ${FALLBACK_CODE} để chuyển.`)
        this.exitCode = 1
        return
      }
      await Publication.query()
        .where('research_output_type_id', type.id)
        .update({ research_output_type_id: fallback.id })
      this.logger.warning(`Đã chuyển ${n} công bố → ${FALLBACK_CODE} (id=${fallback.id})`)
    }

    await ResearchOutputRule.query().where('type_id', type.id).delete()
    await type.delete()
    this.logger.success(`Đã xóa ${CODE} (id=${type.id}) và rule liên quan.`)
  }
}
