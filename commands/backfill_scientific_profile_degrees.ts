import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { backfillScientificProfileDegreeKeys } from '#services/scientific_profile_degree_backfill_service'

export default class BackfillScientificProfileDegrees extends BaseCommand {
  static commandName = 'backfill:scientific-profile-degrees'
  static description = 'Chuyển degree từ nhãn cũ sang key (TU_TAI, DAI_HOC, …)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ flagName: 'dry-run', description: 'Chỉ báo cáo, không ghi DB' })
  declare dryRun: boolean

  async run() {
    const report = await backfillScientificProfileDegreeKeys(this.dryRun)

    this.logger.info(`Tổng hồ sơ: ${report.total}`)
    this.logger.success(`Map được key: ${report.mapped}`)
    this.logger.info(`Không đổi: ${report.unchanged}`)
    this.logger.warning(`${this.dryRun ? 'Sẽ cập nhật' : 'Đã cập nhật'}: ${report.updated}`)
    this.logger.warning(`Không khớp: ${report.unmatched.length}`)

    for (const row of report.unmatched.slice(0, 30)) {
      this.logger.warning(`  [profile=${row.profileId}] degree="${row.oldDegree}"`)
    }
  }
}
