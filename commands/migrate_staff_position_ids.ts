import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import StaffPositionIdsMigrateService from '#services/staff_position_ids_migrate_service'

/**
 * Chuyển position_title / party_position từ tên text → chuỗi ID catalog.
 * Gộp concurrent_position + highest_position vào position_title.
 *
 * node ace migrate:staff-position-ids
 * node ace migrate:staff-position-ids --apply
 */
export default class MigrateStaffPositionIds extends BaseCommand {
  static commandName = 'migrate:staff-position-ids'
  static description = 'Chuyển chức vụ staffs sang lưu ID danh mục (cách phẩy)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ flagName: 'apply', description: 'Ghi DB' })
  declare apply: boolean

  async run() {
    const report = await StaffPositionIdsMigrateService.run(this.apply)
    this.logger.info(`Tổng staff: ${report.staffTotal}`)
    this.logger.warning(`Cần/cập nhật: ${report.staffUpdated}`)
    this.logger.info(`Map POSITION: ${report.positionMapped} | PARTY: ${report.partyMapped}`)
    if (report.unmappedNames.length) {
      this.logger.warning(`Tên không khớp catalog (${report.unmappedNames.length}):`)
      for (const n of report.unmappedNames.slice(0, 30)) this.logger.warning(`  - ${n}`)
    }
    if (this.apply) this.logger.success(`Đã ghi: ${report.staffUpdated} staff`)
    else this.logger.info('Dry-run — thêm --apply để ghi')
  }
}
