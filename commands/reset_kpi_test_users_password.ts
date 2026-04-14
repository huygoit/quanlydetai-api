import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'

export default class ResetKpiTestUsersPassword extends BaseCommand {
  static commandName = 'reset:kpi-test-users-password'
  static description = 'Đặt lại mật khẩu cho 2 tài khoản test KPI'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'password',
    alias: 'p',
    description: 'Mật khẩu mới (mặc định: Test@123456)',
  })
  declare password?: string

  async run() {
    const nextPassword = (this.password || 'Test@123456').trim()
    const emails = ['ncv.test.kpi@dhsudn.local', 'ncv.test.kpi.female@dhsudn.local']

    let updated = 0
    for (const email of emails) {
      const user = await User.query().where('email', email).first()
      if (!user) {
        this.logger.warning(`Không tìm thấy user: ${email}`)
        continue
      }
      // User model dùng withAuthFinder: truyền plain password để model tự hash chuẩn.
      user.password = nextPassword
      user.isActive = true
      await user.save()
      updated += 1
      this.logger.success(`Đã reset mật khẩu: ${email}`)
    }

    this.logger.info(`Hoàn tất. Số user đã cập nhật: ${updated}`)
  }
}
