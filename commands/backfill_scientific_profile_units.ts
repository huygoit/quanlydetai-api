import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { backfillScientificProfileUnits } from '#services/scientific_profile_unit_mapper_service'

export default class BackfillScientificProfileUnits extends BaseCommand {
  static commandName = 'backfill:scientific-profile-units'
  static description =
    'Map organization → organization_id (UDN_AFFILIATION_UNITS) và faculty → department_id (departments)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Chỉ báo cáo, không ghi database',
  })
  declare dryRun: boolean

  async run() {
    const report = await backfillScientificProfileUnits(this.dryRun)

    this.logger.info(`Tổng hồ sơ: ${report.total}`)
    this.logger.success(`Khớp organization_id: ${report.organizationMatched}`)
    this.logger.success(`Khớp department_id: ${report.facultyMatched}`)
    this.logger.info(`Không đổi: ${report.unchanged}`)
    this.logger.warning(
      `${this.dryRun ? 'Sẽ cập nhật' : 'Đã cập nhật'}: ${report.updated} (dry-run=${this.dryRun})`
    )
    this.logger.warning(`Không khớp organization: ${report.unmatchedOrganization.length}`)
    this.logger.warning(`Không khớp faculty: ${report.unmatchedFaculty.length}`)

    for (const row of report.unmatchedOrganization.slice(0, 30)) {
      this.logger.warning(
        `  [profile=${row.profileId}] org="${row.oldOrganization}" → (${row.orgReason})`
      )
    }
    if (report.unmatchedOrganization.length > 30) {
      this.logger.warning(`  ... còn ${report.unmatchedOrganization.length - 30} organization chưa khớp`)
    }

    for (const row of report.unmatchedFaculty.slice(0, 30)) {
      this.logger.warning(
        `  [profile=${row.profileId}] faculty="${row.oldFaculty}" → (${row.facultyReason})`
      )
    }
    if (report.unmatchedFaculty.length > 30) {
      this.logger.warning(`  ... còn ${report.unmatchedFaculty.length - 30} faculty chưa khớp`)
    }
  }
}
