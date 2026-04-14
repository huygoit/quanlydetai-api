import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import StaffProfileSyncService from '#services/staff_profile_sync_service'

export default class SyncStaffProfiles extends BaseCommand {
  static commandName = 'sync:staff-profiles'
  static description =
    'Đồng bộ staffs -> scientific_profiles theo user_id (có thì update, chưa có thì tạo mới)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Chỉ mô phỏng, không ghi dữ liệu',
  })
  declare dryRun: boolean

  @flags.boolean({
    flagName: 'no-link-by-email',
    description: 'Không tự gán user_id từ email staff',
  })
  declare noLinkByEmail: boolean

  async run() {
    const report = await StaffProfileSyncService.sync({
      dryRun: this.dryRun,
      autoLinkByEmail: !this.noLinkByEmail,
    })

    this.logger.info(`Tổng staff: ${report.totalStaff}`)
    this.logger.info(`Chuẩn hóa gender ở staffs: ${report.normalizedStaffGender}`)
    this.logger.info(`Tổng staff có user_id: ${report.totalStaffWithUser}`)
    this.logger.info(`Tự gán user_id theo email: ${report.autoLinkedByEmail}`)
    this.logger.warning(`Bỏ qua do user đã gắn staff khác: ${report.skippedUserAlreadyLinked}`)
    this.logger.success(`Tạo mới hồ sơ khoa học: ${report.created}`)
    this.logger.success(`Cập nhật hồ sơ khoa học: ${report.updated}`)
    this.logger.info(`Không đổi: ${report.unchanged}`)
    this.logger.warning(`Bỏ qua do user không tồn tại: ${report.skippedMissingUser}`)
    this.logger.warning(`Lỗi: ${report.errors.length}`)

    for (const e of report.errors.slice(0, 50)) {
      this.logger.error(`  [staff_id=${e.staffId} | ${e.staffCode}] ${e.reason}`)
    }
    if (report.errors.length > 50) {
      this.logger.warning(`... còn ${report.errors.length - 50} lỗi chưa hiển thị`)
    }

    if (report.errors.length > 0) {
      this.exitCode = 1
    }
  }
}

