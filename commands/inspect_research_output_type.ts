import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ResearchOutputType from '#models/research_output_type'
import ResearchOutputRule from '#models/research_output_rule'

export default class InspectResearchOutputType extends BaseCommand {
  static commandName = 'inspect:research-output-type'
  static description = 'Tra cứu loại kết quả NCKH theo code'

  static options: CommandOptions = { startApp: true }

  @args.string()
  declare code: string

  async run() {
    const row = await ResearchOutputType.query().where('code', this.code).first()
    if (!row) return this.logger.warning('NOT FOUND')
    const rule = await ResearchOutputRule.query().where('type_id', row.id).first()
    this.logger.info(JSON.stringify({ row: row.toJSON(), rule: rule?.toJSON() }, null, 2))
  }
}
