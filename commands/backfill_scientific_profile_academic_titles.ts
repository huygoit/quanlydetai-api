import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { backfillScientificProfileAcademicTitleKeys } from '#services/scientific_profile_academic_title_backfill_service'

export default class BackfillScientificProfileAcademicTitles extends BaseCommand {
  static commandName = 'backfill:scientific-profile-academic-titles'
  static description = 'Chuyển academicTitle sang key (NONE, ASSOCIATE_PROFESSOR, PROFESSOR)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ flagName: 'dry-run', description: 'Chỉ báo cáo, không ghi DB' })
  declare dryRun: boolean

  async run() {
    const report = await backfillScientificProfileAcademicTitleKeys(this.dryRun)

    this.logger.info(`Tổng hồ sơ: ${report.total}`)
    this.logger.success(`Map được key: ${report.mapped}`)
    this.logger.info(`Không đổi: ${report.unchanged}`)
    this.logger.warning(`${this.dryRun ? 'Sẽ cập nhật' : 'Đã cập nhật'}: ${report.updated}`)
    this.logger.warning(`Không khớp: ${report.unmatched.length}`)

    for (const row of report.unmatched.slice(0, 30)) {
      this.logger.warning(`  [profile=${row.profileId}] academicTitle="${row.oldTitle}"`)
    }
  }
}
